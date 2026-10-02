import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { log } from '@/lib/logging'
import { getMetaLeadsApiKey, isDev, isProd } from '@/lib/env'
import { rateLimit } from '@/lib/rate-limit'
import { isValidPhone, isValidZip, stripBomWs } from '@/lib/validation'
import { timingSafeEqual } from '@/lib/utils'
import type { ProductType } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type MetaLeadPayload = {
  name: string
  phone: string
  stromverbrauch?: string | null
  plz?: string | null
}

function sanitizeText(raw: string, maxLen = 200): string {
  let s = String(raw ?? '')
  s = s.replace(/<[^>]*>/g, '')
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  s = s.replace(/\uFEFF/g, '').trim()
  if (s.length > maxLen) s = s.slice(0, maxLen)
  return s
}

function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return { first_name: '', last_name: '' }
  if (parts.length === 1) return { first_name: parts[0] ?? '', last_name: '' }
  const last = parts[parts.length - 1] ?? ''
  const first = parts.slice(0, -1).join(' ')
  return { first_name: first, last_name: last }
}

function parsePowerConsumption(raw: string | null | undefined): number | null {
  if (!raw) return null
  const match = String(raw).match(/([\d.,]+)/)
  if (!match) return null
  let numStr = match[1] ?? ''
  if (numStr.includes(',') && numStr.includes('.')) {
    numStr = numStr.replace(/\./g, '').replace(',', '.')
  } else if (numStr.includes(',')) {
    numStr = numStr.replace(',', '.')
  }
  const n = Number(numStr)
  if (Number.isNaN(n) || !Number.isFinite(n)) return null
  if (n < 0) return null
  const rounded = Math.round(n)
  if (rounded > 50000) return 50000
  return rounded
}

function extractBearerToken(req: Request): string | undefined {
  const authHeader = stripBomWs(
    req.headers.get('authorization') ?? req.headers.get('Authorization'),
  )
  if (!authHeader) return undefined
  const [scheme, token] = authHeader.split(/\s+/)
  if (!scheme || !token) return undefined
  if (scheme.toLowerCase() !== 'bearer') return undefined
  return token
}

function securityHeadersInit(init: ResponseInit = {}): ResponseInit {
  const existingHeaders = new Headers(init.headers ?? {})
  existingHeaders.set('X-Frame-Options', 'DENY')
  existingHeaders.set('X-Content-Type-Options', 'nosniff')
  existingHeaders.set('Referrer-Policy', 'no-referrer')
  existingHeaders.set('X-XSS-Protection', '1; mode=block')
  existingHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  existingHeaders.set('Pragma', 'no-cache')
  existingHeaders.set('Expires', '0')
  if (isProd()) {
    existingHeaders.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    )
  }
  return { ...init, headers: existingHeaders }
}

function jsonResponse<T>(body: T, init: ResponseInit = {}): NextResponse<T> {
  return NextResponse.json(body, securityHeadersInit(init))
}

export async function OPTIONS(req: Request) {
  const existingHeaders = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  })
  const withSec = securityHeadersInit({ headers: existingHeaders })
  return new NextResponse(null, { ...withSec, status: 204 })
}

export async function POST(req: Request) {
  const rl = rateLimit(req, 'metaLeads', {
    max: 120,
    windowMs: 60 * 1000,
    refillIntervalMs: 500,
  })
  const rlHeaders = {
    'X-RateLimit-Limit': String(rl.limit),
    'X-RateLimit-Remaining': String(rl.remaining),
  } as HeadersInit
  if (!rl.ok) {
    const secs = Math.max(1, Math.ceil(rl.retryAfterMs / 1000))
    return jsonResponse(
      { status: 'error', error: 'TOO_MANY_REQUESTS', message: 'Zu viele Anfragen.' },
      {
        status: 429,
        headers: { ...rlHeaders, 'Retry-After': String(secs) },
      },
    )
  }

  try {
    const bearerToken = extractBearerToken(req)

    let metaKey: string | null = null
    try {
      metaKey = getMetaLeadsApiKey()
    } catch (envErr) {
      log.error(
        'META_LEADS',
        'META_LEADS_API_KEY Konfiguration unvollständig',
        undefined,
        envErr,
      )
      metaKey = null
    }

    const tokenOk =
      !!bearerToken && !!metaKey ? await timingSafeEqual(bearerToken, metaKey) : false

    if (!tokenOk) {
      log.warn('META_LEADS', 'Bearer Token abgelehnt', {
        hasToken: Boolean(bearerToken),
      })
      return jsonResponse(
        { status: 'error', error: 'UNAUTHORIZED', message: 'Ungültiger oder fehlender API-Token.' },
        { status: 401, headers: rlHeaders },
      )
    }

    let body: MetaLeadPayload
    try {
      body = (await req.json()) as MetaLeadPayload
    } catch {
      return jsonResponse(
        { status: 'error', error: 'INVALID_JSON', message: 'Ungültiges JSON-Format.' },
        { status: 400, headers: rlHeaders },
      )
    }

    const errors: Record<string, string> = {}

    const cleanName = sanitizeText(body.name ?? '', 150)
    if (!cleanName || cleanName.length < 2) {
      errors.name = 'Name muss mindestens 2 Zeichen lang sein.'
    }

    const { first_name, last_name } = splitFullName(cleanName)
    if (!first_name || first_name.trim().length < 2) {
      errors.first_name = 'Vorname muss mindestens 2 Zeichen lang sein.'
    }
    if (!last_name || last_name.trim().length < 2) {
      errors.last_name = 'Nachname muss mindestens 2 Zeichen lang sein.'
    }

    const cleanPhone = sanitizeText(body.phone ?? '', 40)
    if (!cleanPhone || !isValidPhone(cleanPhone)) {
      errors.phone = 'Bitte gib eine gültige Telefonnummer ein (8–18 Ziffern).'
    }

    const cleanPlz = sanitizeText(body.plz ?? '', 10)
    if (cleanPlz && !isValidZip(cleanPlz)) {
      errors.plz = 'Bitte gib eine gültige 5-stellige PLZ ein.'
    }

    const powerConsumption = parsePowerConsumption(body.stromverbrauch ?? null)
    if (
      (body.stromverbrauch ?? '').trim() &&
      powerConsumption === null
    ) {
      errors.stromverbrauch = 'Stromverbrauch konnte nicht ausgewertet werden.'
    }

    if (Object.keys(errors).length > 0) {
      log.warn('META_LEADS', 'Validierung fehlgeschlagen', { errors })
      return jsonResponse(
        {
          status: 'error',
          error: 'VALIDATION_FAILED',
          message: 'Validierung fehlgeschlagen.',
          errors,
        },
        { status: 400, headers: rlHeaders },
      )
    }

    const admin = createAdminClient()

    const notesParts: string[] = ['[Meta / Facebook Lead Ads]']
    if (powerConsumption != null) {
      notesParts.push(`Stromverbrauch (Original): ${String(body.stromverbrauch ?? '').trim()}`)
    }

    const product: ProductType = 'strom'

    const insertPayload: Record<string, unknown> = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone: cleanPhone,
      email: null,
      street: null,
      zip: cleanPlz || null,
      city: null,
      product,
      power_consumption: powerConsumption,
      gas_consumption: null,
      campaign_id: null,
      notes: notesParts.join('\n'),
      status: 'new',
      token_cost: 1,
      source: 'meta_ads',
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
        log.warn(
          'META_LEADS',
          `Lead-Insert mit source="${source}" fehlgeschlagen`,
          undefined,
          error,
        )
        throw error ?? new Error('NO_DATA')
      }
      return (data as unknown as { id: string }).id
    }

    try {
      leadId = await tryInsert('meta_ads')
    } catch (metaSourceErr) {
      const msg =
        metaSourceErr instanceof Error ? metaSourceErr.message : String(metaSourceErr ?? '')
      if (msg.includes('lead_source') || msg.includes('invalid input') || msg.includes('enum')) {
        try {
          leadId = await tryInsert('sonstiges')
        } catch (fbErr) {
          log.error(
            'META_LEADS',
            'Insert mit Fallback-Source fehlgeschlagen',
            undefined,
            fbErr,
          )
          throw fbErr instanceof Error ? fbErr : new Error('INSERT_FAILED_FALLBACK')
        }
      } else {
        log.error('META_LEADS', 'Insert fehlgeschlagen', undefined, metaSourceErr)
        throw metaSourceErr instanceof Error
          ? metaSourceErr
          : new Error('INSERT_FAILED')
      }
    }

    await logAudit(null, 'LEAD_CREATED', 'lead', leadId, {
      source: 'meta_ads_api',
      product,
      power_consumption: powerConsumption,
    }).catch((e) =>
      log.warn('META_LEADS', 'Audit-Log fehlgeschlagen (swallowed)', undefined, e),
    )

    log.info('META_LEADS', 'Lead erfolgreich angelegt', {
      lead_id: leadId,
      source: 'meta_ads',
      plz: cleanPlz || null,
    })

    return jsonResponse(
      {
        status: 'success',
        message: 'Lead saved',
        lead_id: leadId,
      },
      { status: 201, headers: rlHeaders },
    )
  } catch (err) {
    log.error('META_LEADS', 'Unhandled error', undefined, err)
    return jsonResponse(
      {
        status: 'error',
        error: 'INTERNAL_ERROR',
        message: isDev()
          ? err instanceof Error
            ? err.message
            : String(err)
          : 'Interner Serverfehler.',
      },
      { status: 500, headers: rlHeaders },
    )
  }
}

export async function GET() {
  return jsonResponse(
    { status: 'error', error: 'METHOD_NOT_ALLOWED', message: 'Nur POST ist erlaubt.' },
    { status: 405 },
  )
}

export async function PUT() {
  return jsonResponse(
    { status: 'error', error: 'METHOD_NOT_ALLOWED', message: 'Nur POST ist erlaubt.' },
    { status: 405 },
  )
}

export async function DELETE() {
  return jsonResponse(
    { status: 'error', error: 'METHOD_NOT_ALLOWED', message: 'Nur POST ist erlaubt.' },
    { status: 405 },
  )
}
