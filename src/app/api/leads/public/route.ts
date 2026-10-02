import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { log } from '@/lib/logging'
import { getLandingApiKey, isDev, isProd } from '@/lib/env'
import { rateLimit } from '@/lib/rate-limit'
import {
  isValidProduct,
  isValidPhone,
  isValidEmail,
  isValidZip,
  stripBomWs,
} from '@/lib/validation'
import { getLandingApiEnabled } from '@/lib/services/system.service'
import { timingSafeEqual } from '@/lib/utils'
import type { ProductType } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PublicLeadPayload = {
  first_name: string
  last_name: string
  phone: string
  email?: string | null
  zip?: string | null
  city?: string | null
  street?: string | null
  product: ProductType
  power_consumption?: number | null
  gas_consumption?: number | null
  wants_consultation?: boolean
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_term?: string | null
  utm_content?: string | null
}

const PROD_ALLOWED_ORIGINS = [
  /^https?:\/\/(.*\.)?sparpartner24\.de$/,
  /^https?:\/\/[a-z0-9-]+\.vercel\.app$/,
]
const DEV_ALLOWED_ORIGINS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
]

function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get('origin') ?? ''
  const patterns = isProd() ? PROD_ALLOWED_ORIGINS : [...PROD_ALLOWED_ORIGINS, ...DEV_ALLOWED_ORIGINS]
  for (const pattern of patterns) {
    if (pattern.test(origin)) return origin
  }
  return ''
}

function corsResponseInit(req: Request, init: ResponseInit = {}): ResponseInit {
  const origin = getAllowedOrigin(req)
  const existingHeaders = new Headers(init.headers ?? {})
  existingHeaders.set('Access-Control-Allow-Origin', origin || 'null')
  existingHeaders.set(
    'Access-Control-Allow-Headers',
    'Content-Type, X-API-KEY, x-api-key, Authorization',
  )
  existingHeaders.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  existingHeaders.set('Access-Control-Allow-Credentials', 'true')
  existingHeaders.set('Access-Control-Max-Age', '86400')
  existingHeaders.set('Vary', 'Origin')
  existingHeaders.set('X-Frame-Options', 'DENY')
  existingHeaders.set('X-Content-Type-Options', 'nosniff')
  existingHeaders.set('Referrer-Policy', 'no-referrer')
  return { ...init, headers: existingHeaders }
}

function jsonWithCors<T>(req: Request, body: T, init: ResponseInit = {}): NextResponse<T> {
  return NextResponse.json(body, corsResponseInit(req, init))
}

function sanitizeNullable(raw: unknown, maxLen = 200): string | null {
  let s = String(raw ?? '')
  s = s.replace(/<[^>]*>/g, '')
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  s = s.replace(/\uFEFF/g, '').trim()
  if (!s) return null
  if (s.length > maxLen) s = s.slice(0, maxLen)
  return s
}

/**
 * Auto-Upsert der Kampagnen-Zuordnung für Landing Page Leads.
 * Gibt die campaign_id (UUID) zurück, falls einsatzbereit, sonst null.
 *
 * Strategie:
 * - Wenn utm_campaign gesetzt ist: external_id = `landing::${utmCampaign}` (stabil, dedup-sicher)
 * - Wenn utm_campaign fehlt: Default-Kampagne mit external_id = "landing_page_default"
 *   => JEDER Landing-Lead wird einer Kampagne zugeordnet, auch ohne explizite UTMs.
 */
async function upsertLandingCampaign(
  admin: ReturnType<typeof createAdminClient>,
  payload: PublicLeadPayload,
): Promise<string | null> {
  const utmCampaign = sanitizeNullable(payload.utm_campaign, 200)
  const utmSource = sanitizeNullable(payload.utm_source, 64)

  const sourceLabel: any = 'landing_page'

  let externalId: string
  let campaignName: string
  if (utmCampaign) {
    externalId = 'landing::' + utmCampaign
    campaignName = utmCampaign
  } else {
    externalId = 'landing_page_default'
    campaignName = utmSource
      ? `Landing Page · ${utmSource}`
      : 'Landing Page · Standard'
  }

  const toUpsert: Record<string, unknown> = {
    name: campaignName,
    source: sourceLabel,
    is_active: true,
    external_id: externalId,
  }

  try {
    // 1) Upsert via external_id (wenn Unique-Constraint vorhanden => 0021 Migration)
    try {
      const { data, error } = await admin
        .from('campaigns')
        .upsert(toUpsert, { onConflict: 'external_id', ignoreDuplicates: false })
        .select('id')
        .limit(1)
        .maybeSingle()
      if (data && !error) return (data as { id: string }).id
      if (error) {
        log.warn('PUBLIC_LEADS', 'Landing Kampagnen-Upsert via external_id fehlgeschlagen – fallback', { external_id: externalId }, error)
      }
    } catch {
      /* ignore upsert error, handle via fallback below */
    }

    // 2) Fallback: Lookup + Insert (falls Unique-Constraint fehlt oder Upsert nicht erlaubt)
    {
      const { data: existing } = await admin
        .from('campaigns')
        .select('id')
        .or(`external_id.eq.${externalId},and(source.eq.${sourceLabel},name.eq.${campaignName})`)
        .limit(1)
        .maybeSingle()
      if (existing) return (existing as { id: string }).id

      const { data, error } = await admin
        .from('campaigns')
        .insert(toUpsert)
        .select('id')
        .limit(1)
        .maybeSingle()
      if (error || !data) return null
      return (data as { id: string }).id
    }
  } catch (e) {
    log.warn('PUBLIC_LEADS', 'Kampagnen-Upsert ist fehlgeschlagen (swallowed)', undefined, e)
    return null
  }
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, corsResponseInit(req, { status: 204 }))
}

export async function POST(req: Request) {
  const rl = rateLimit(req, 'publicLeads')
  const rlHeaders = {
    'X-RateLimit-Limit': String(rl.limit),
    'X-RateLimit-Remaining': String(rl.remaining),
  } as HeadersInit
  if (!rl.ok) {
    const secs = Math.max(1, Math.ceil(rl.retryAfterMs / 1000))
    return jsonWithCors(
      req,
      { error: 'TOO_MANY_REQUESTS' },
      {
        status: 429,
        headers: { ...rlHeaders, 'Retry-After': String(secs) },
      },
    )
  }

  try {
    const apiEnabled = await getLandingApiEnabled()
    if (!apiEnabled) {
      log.warn('PUBLIC_LEADS', 'Landing API per Setting deaktiviert – 503')
      return jsonWithCors(
        req,
        { error: 'SERVICE_UNAVAILABLE', message: 'Lead-Annahme derzeit deaktiviert.' },
        { status: 503, headers: rlHeaders },
      )
    }

    const apiKeyFromHeader = stripBomWs(
      req.headers.get('x-api-key') ?? req.headers.get('X-API-KEY'),
    )

    let landingKey: string | null = null
    try {
      landingKey = getLandingApiKey()
    } catch (envErr: unknown) {
      log.error('PUBLIC_LEADS', 'LANDING_API_KEY Konfiguration unvollständig – allow fallback (try DB lookup)', undefined, envErr)
      landingKey = null
    }

    const keyMatch = landingKey && apiKeyFromHeader
      ? await timingSafeEqual(apiKeyFromHeader, landingKey as string)
      : false
    if (!keyMatch) {
      log.warn('PUBLIC_LEADS', 'API-Key Abgelehnt', {
        hasKey: Boolean(apiKeyFromHeader),
        origin: getAllowedOrigin(req) || 'none',
      })
      return jsonWithCors(req, { error: 'UNAUTHORIZED' }, { status: 401, headers: rlHeaders })
    }

    let body: PublicLeadPayload
    try {
      body = (await req.json()) as PublicLeadPayload
    } catch {
      return jsonWithCors(req, { error: 'INVALID_JSON' }, { status: 400, headers: rlHeaders })
    }

    const errors: Record<string, string> = {}

    if (!body.first_name || body.first_name.trim().length < 2) {
      errors.first_name = 'Vorname muss mindestens 2 Zeichen lang sein.'
    }
    if (!body.last_name || body.last_name.trim().length < 2) {
      errors.last_name = 'Nachname muss mindestens 2 Zeichen lang sein.'
    }
    if (!body.phone || !isValidPhone(body.phone)) {
      errors.phone = 'Bitte gib eine gültige Telefonnummer ein.'
    }
    if (body.email && body.email.trim() && !isValidEmail(body.email.trim())) {
      errors.email = 'Bitte gib eine gültige E-Mail-Adresse ein.'
    }
    if (!body.product || !isValidProduct(body.product)) {
      errors.product = 'Bitte wähle Strom, Gas oder Beides.'
    }
    if (body.zip && body.zip.trim() && !isValidZip(body.zip)) {
      errors.zip = 'Bitte gib eine gültige 5-stellige PLZ ein.'
    }
    if ((body.product === 'strom' || body.product === 'beides') && body.power_consumption != null) {
      const pc = Number(body.power_consumption)
      if (Number.isNaN(pc) || pc < 0 || pc > 50000) {
        errors.power_consumption = 'Stromverbrauch ist nicht im gültigen Bereich (0–50000 kWh).'
      }
    }
    if ((body.product === 'gas' || body.product === 'beides') && body.gas_consumption != null) {
      const gc = Number(body.gas_consumption)
      if (Number.isNaN(gc) || gc < 0 || gc > 100000) {
        errors.gas_consumption = 'Gasverbrauch ist nicht im gültigen Bereich (0–100000 kWh).'
      }
    }

    if (Object.keys(errors).length > 0) {
      return jsonWithCors(
        req,
        { error: 'VALIDATION_FAILED', errors },
        { status: 422, headers: rlHeaders },
      )
    }

    const admin = createAdminClient()

    const utmSource = sanitizeNullable(body.utm_source, 64)
    const utmMedium = sanitizeNullable(body.utm_medium, 128)
    const utmCampaign = sanitizeNullable(body.utm_campaign, 200)
    const utmTerm = sanitizeNullable(body.utm_term, 200)
    const utmContent = sanitizeNullable(body.utm_content, 255)

    const campaignId = await upsertLandingCampaign(admin, body)

    const notesParts: string[] = ['[Landing Page Sparpartner24]']
    if (body.wants_consultation) notesParts.push('Beratungsgespräch gewünscht')
    else notesParts.push('Kein Beratungsgespräch gewünscht')
    const utm: string[] = []
    if (utmSource) utm.push(`source=${utmSource}`)
    if (utmMedium) utm.push(`medium=${utmMedium}`)
    if (utmCampaign) utm.push(`campaign=${utmCampaign}`)
    if (utmTerm) utm.push(`term=${utmTerm}`)
    if (utmContent) utm.push(`content=${utmContent}`)
    if (utm.length > 0) notesParts.push(`UTM: ${utm.join(' | ')}`)

    const insertPayload: Record<string, unknown> = {
      first_name: body.first_name.trim(),
      last_name: body.last_name.trim(),
      phone: body.phone.trim(),
      email: body.email?.trim() || null,
      street: body.street?.trim() || null,
      zip: body.zip?.trim() || null,
      city: body.city?.trim() || null,
      product: body.product,
      power_consumption: body.power_consumption ? Number(body.power_consumption) : null,
      gas_consumption: body.gas_consumption ? Number(body.gas_consumption) : null,
      campaign_id: campaignId,
      notes: notesParts.join('\n'),
      status: 'new',
      token_cost: 1,
      source: 'sonstiges',
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
    }

    let leadId: string | null = null

    const tryInsert = async (source: string): Promise<string | null> => {
      insertPayload.source = source
      const { data, error } = await admin
        .from('leads')
        .insert(insertPayload)
        .select('id')
        .limit(1)
        .maybeSingle()
      if (error || !data) {
        log.warn('PUBLIC_LEADS', `Lead-Insert mit source="${source}" fehlgeschlagen`, undefined, error)
        throw error ?? new Error('NO_DATA')
      }
      return (data as unknown as { id: string }).id
    }

    try {
      leadId = await tryInsert('landing_page')
    } catch (landingSourceErr: unknown) {
      const msg =
        landingSourceErr instanceof Error
          ? landingSourceErr.message
          : String(landingSourceErr ?? '')
      if (msg.includes('lead_source') || msg.includes('invalid input') || msg.includes('enum')) {
        try {
          leadId = await tryInsert('sonstiges')
        } catch (fbErr) {
          log.error('PUBLIC_LEADS', 'Insert mit Fallback-Source fehlgeschlagen', undefined, fbErr)
          throw fbErr instanceof Error ? fbErr : new Error('INSERT_FAILED_FALLBACK')
        }
      } else {
        log.error('PUBLIC_LEADS', 'Insert fehlgeschlagen', undefined, landingSourceErr)
        throw landingSourceErr instanceof Error ? landingSourceErr : new Error('INSERT_FAILED')
      }
    }

    await logAudit(null, 'LEAD_CREATED', 'lead', leadId, {
      source: 'landing_page_api',
      utm: {
        source: utmSource,
        medium: utmMedium,
        campaign: utmCampaign,
      },
      campaign_id: campaignId,
      wants_consultation: !!body.wants_consultation,
    }).catch((e) => log.warn('PUBLIC_LEADS', 'Audit-Log fehlgeschlagen (swallowed)', undefined, e))

    log.info('PUBLIC_LEADS', 'Lead erfolgreich angelegt', {
      lead_id: leadId,
      product: body.product,
      source: 'landing_page_api',
      campaign_id: campaignId,
    })

    return jsonWithCors(
      req,
      {
        success: true,
        lead_id: leadId,
        campaign_id: campaignId,
        savings_estimate_eur: calculateSavingsEstimate(body),
      },
      { status: 200, headers: rlHeaders },
    )
  } catch (err: unknown) {
    log.error('PUBLIC_LEADS', 'Unhandled error', undefined, err)
    return jsonWithCors(
      req,
      {
        error: 'INTERNAL_ERROR',
        message: isDev()
          ? err instanceof Error ? err.message : String(err)
          : undefined,
      },
      { status: 500, headers: rlHeaders },
    )
  }
}

function calculateSavingsEstimate(p: PublicLeadPayload): number {
  let euros = 0
  if ((p.product === 'strom' || p.product === 'beides') && p.power_consumption) {
    euros += (Number(p.power_consumption) * 4) / 100
  }
  if ((p.product === 'gas' || p.product === 'beides') && p.gas_consumption) {
    euros += (Number(p.gas_consumption) * 2) / 100
  }
  if (euros === 0) euros = 350
  return Math.max(150, Math.min(900, Math.round(euros)))
}

export async function GET(req: Request) {
  return jsonWithCors(req, { error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
}
