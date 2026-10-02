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

const PROD_ALLOWED_ORIGINS = [/^https?:\/\/(.*\.)?sparpartner24\.de$/]
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
  // Prevent Clickjacking & MIME-Sniffing auf API-Ebene zusätzlich.
  existingHeaders.set('X-Frame-Options', 'DENY')
  existingHeaders.set('X-Content-Type-Options', 'nosniff')
  existingHeaders.set('Referrer-Policy', 'no-referrer')
  return { ...init, headers: existingHeaders }
}

function jsonWithCors<T>(req: Request, body: T, init: ResponseInit = {}): NextResponse<T> {
  return NextResponse.json(body, corsResponseInit(req, init))
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  try {
    const enc = new TextEncoder()
    const [ha, hb] = await Promise.all([
      crypto.subtle.digest('SHA-256', enc.encode(a)),
      crypto.subtle.digest('SHA-256', enc.encode(b)),
    ])
    if (ha.byteLength !== hb.byteLength) return false
    const va = new Uint8Array(ha)
    const vb = new Uint8Array(hb)
    let diff = 0
    for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i]
    return diff === 0
  } catch {
    // Fallback: explizit KEINEN direkten String-Vergleich, um Timing zu vermeiden.
    return false
  }
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, corsResponseInit(req, { status: 204 }))
}

export async function POST(req: Request) {
  // ---------- Rate-Limit (pro IP) ----------
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

    let landingKey: string
    try {
      landingKey = getLandingApiKey()
    } catch (envErr: unknown) {
      log.error('PUBLIC_LEADS', 'LANDING_API_KEY Konfiguration unvollständig', undefined, envErr)
      return jsonWithCors(
        req,
        { error: 'SERVER_MISCONFIGURED' },
        { status: 500, headers: rlHeaders },
      )
    }

    const keyMatch = apiKeyFromHeader
      ? await timingSafeEqual(apiKeyFromHeader, landingKey)
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

    let campaignId: string | null = null
    if (body.utm_campaign && body.utm_campaign.trim()) {
      try {
        const { data: camp } = await admin
          .from('campaigns')
          .select('id')
          .or(`external_id.eq.${body.utm_campaign.trim()},name.ilike.%${body.utm_campaign.trim()}%`)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()
        if (camp) campaignId = (camp as unknown as { id: string }).id
      } catch (e) {
        log.warn('PUBLIC_LEADS', 'Campaign-Auflösung fehlgeschlagen (ignoriert)', {
          utm_campaign: body.utm_campaign,
        }, e)
      }
    }

    const notesParts: string[] = ['[Landing Page Sparpartner24]']
    if (body.wants_consultation) notesParts.push('Beratungsgespräch gewünscht')
    else notesParts.push('Kein Beratungsgespräch gewünscht')
    const utm: string[] = []
    if (body.utm_source) utm.push(`source=${body.utm_source}`)
    if (body.utm_medium) utm.push(`medium=${body.utm_medium}`)
    if (body.utm_campaign) utm.push(`campaign=${body.utm_campaign}`)
    if (body.utm_term) utm.push(`term=${body.utm_term}`)
    if (body.utm_content) utm.push(`content=${body.utm_content}`)
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
        source: body.utm_source ?? null,
        medium: body.utm_medium ?? null,
        campaign: body.utm_campaign ?? null,
      },
      wants_consultation: !!body.wants_consultation,
    }).catch((e) => log.warn('PUBLIC_LEADS', 'Audit-Log fehlgeschlagen (swallowed)', undefined, e))

    log.info('PUBLIC_LEADS', 'Lead erfolgreich angelegt', {
      lead_id: leadId,
      product: body.product,
      source: 'landing_page_api',
    })

    return jsonWithCors(
      req,
      {
        success: true,
        lead_id: leadId,
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
