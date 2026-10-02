import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
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

const LANDING_API_KEY = process.env.LANDING_API_KEY?.trim()

const ALLOWED_ORIGINS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/(.*\.)?sparpartner24\.de$/,
]

function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get('origin') ?? ''
  for (const pattern of ALLOWED_ORIGINS) {
    if (pattern.test(origin)) return origin
  }
  return process.env.NODE_ENV === 'production' ? '' : origin || '*'
}

function corsResponseInit(req: Request, init: ResponseInit = {}): ResponseInit {
  const origin = getAllowedOrigin(req)
  const existingHeaders = new Headers(init.headers ?? {})
  existingHeaders.set('Access-Control-Allow-Origin', origin)
  existingHeaders.set(
    'Access-Control-Allow-Headers',
    'Content-Type, X-API-KEY, x-api-key, Authorization',
  )
  existingHeaders.set('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
  existingHeaders.set('Access-Control-Allow-Credentials', 'true')
  existingHeaders.set('Access-Control-Max-Age', '86400')
  existingHeaders.set('Vary', 'Origin')
  return { ...init, headers: existingHeaders }
}

function jsonWithCors<T>(req: Request, body: T, init: ResponseInit = {}): NextResponse<T> {
  return NextResponse.json(body, corsResponseInit(req, init))
}

function stripBomWs(s?: string | null) {
  if (!s) return undefined
  return s.replace(/^\uFEFF+/, '').trim() || undefined
}

function isValidProduct(p: string): p is ProductType {
  return p === 'strom' || p === 'gas' || p === 'beides'
}

function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 18
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidZip(zip: string) {
  return /^\d{5}$/.test(zip.trim())
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, corsResponseInit(req, { status: 204 }))
}

export async function POST(req: Request) {
  try {
    const apiKeyFromHeader = stripBomWs(req.headers.get('x-api-key') ?? req.headers.get('X-API-KEY'))

    if (!LANDING_API_KEY || LANDING_API_KEY.length < 16) {
      console.error('[PUBLIC_LEADS] LANDING_API_KEY ist nicht oder zu kurz gesetzt (min. 16 Zeichen).')
      return jsonWithCors(req, { error: 'SERVER_MISCONFIGURED' }, { status: 500 })
    }

    if (!apiKeyFromHeader || apiKeyFromHeader !== LANDING_API_KEY) {
      return jsonWithCors(req, { error: 'UNAUTHORIZED' }, { status: 401 })
    }

    let body: PublicLeadPayload
    try {
      body = (await req.json()) as PublicLeadPayload
    } catch {
      return jsonWithCors(req, { error: 'INVALID_JSON' }, { status: 400 })
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
      return jsonWithCors(req, { error: 'VALIDATION_FAILED', errors }, { status: 422 })
    }

    const admin = createAdminClient()

    let campaignId: string | null = null
    if (body.utm_campaign && body.utm_campaign.trim()) {
      const { data: camp } = await admin
        .from('campaigns')
        .select('id')
        .or(`external_id.eq.${body.utm_campaign.trim()},name.ilike.%${body.utm_campaign.trim()}%`)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      if (camp) campaignId = (camp as any).id
    }

    const notesParts: string[] = ['[Landing Page Sparpartner24]']
    if (body.wants_consultation) notesParts.push('✅ Beratungsgespräch gewünscht')
    else notesParts.push('❌ Kein Beratungsgespräch gewünscht')
    const utm: string[] = []
    if (body.utm_source) utm.push(`source=${body.utm_source}`)
    if (body.utm_medium) utm.push(`medium=${body.utm_medium}`)
    if (body.utm_campaign) utm.push(`campaign=${body.utm_campaign}`)
    if (body.utm_term) utm.push(`term=${body.utm_term}`)
    if (body.utm_content) utm.push(`content=${body.utm_content}`)
    if (utm.length > 0) notesParts.push(`UTM: ${utm.join(' | ')}`)

    const insertPayload: any = {
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

    try {
      insertPayload.source = 'landing_page'
      const { data, error } = await admin
        .from('leads')
        .insert(insertPayload)
        .select('id')
        .limit(1)
        .maybeSingle()
      if (error || !data) {
        throw error ?? new Error('NO_DATA')
      }
      leadId = (data as any).id
    } catch (landingSourceErr: any) {
      const msg = landingSourceErr?.message ?? String(landingSourceErr ?? '')
      if (msg.includes('lead_source') || msg.includes('invalid input') || msg.includes('enum')) {
        insertPayload.source = 'sonstiges'
        const { data, error } = await admin
          .from('leads')
          .insert(insertPayload)
          .select('id')
          .limit(1)
          .maybeSingle()
        if (error || !data) {
          console.error('[PUBLIC_LEADS] Insert mit Fallback-Source fehlgeschlagen:', error)
          throw error ?? new Error('INSERT_FAILED_FALLBACK')
        }
        leadId = (data as any).id
      } else {
        console.error('[PUBLIC_LEADS] Insert fehlgeschlagen:', landingSourceErr)
        throw landingSourceErr
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
    })

    try {
      const { data: users } = await admin
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .eq('is_active', true)
      const notifTitle = `Neuer Lead: ${body.first_name.trim()} ${body.last_name.trim()}`
      const productLabel =
        body.product === 'strom' ? 'Strom' : body.product === 'gas' ? 'Gas' : 'Strom + Gas'
      const location = [body.zip, body.city].filter(Boolean).join(' ').trim()
      const notifBody = [
        `Produkt: ${productLabel}`,
        location ? `Ort: ${location}` : null,
        body.phone ? `Tel.: ${body.phone.trim()}` : null,
        body.wants_consultation ? 'Beratung gewünscht ✅' : null,
      ]
        .filter(Boolean)
        .join(' · ')

      const link = `/leads/${leadId}`

      for (const u of (users ?? []) as any[]) {
        try {
          await admin.rpc('create_notification', {
            p_user_id: u.id,
            p_type: 'LEAD_NEW',
            p_title: notifTitle,
            p_body: notifBody,
            p_link: link,
            p_data: { lead_id: leadId, source: 'landing_page' },
          })
        } catch (notifErr) {
          console.warn(`[PUBLIC_LEADS] Benachrichtigung an Admin ${u.id} fehlgeschlagen:`, notifErr)
        }
      }
    } catch (adminNotifErr) {
      console.warn('[PUBLIC_LEADS] Admin-Benachrichtigungen übersprungen:', adminNotifErr)
    }

    return jsonWithCors(
      req,
      {
        success: true,
        lead_id: leadId,
        savings_estimate_eur: calculateSavingsEstimate(body),
      },
      { status: 200 },
    )
  } catch (err: any) {
    console.error('[PUBLIC_LEADS] Unhandled error:', err)
    return jsonWithCors(
      req,
      {
        error: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'development' ? String(err?.message ?? err) : undefined,
      },
      { status: 500 },
    )
  }
}

function calculateSavingsEstimate(p: PublicLeadPayload): number {
  let euros = 0
  if ((p.product === 'strom' || p.product === 'beides') && p.power_consumption) {
    const avgCentsPerKwh = 30
    const savingCentsPerKwh = 4
    euros += (Number(p.power_consumption) * savingCentsPerKwh) / 100
    void avgCentsPerKwh
  }
  if ((p.product === 'gas' || p.product === 'beides') && p.gas_consumption) {
    const savingCentsPerKwh = 2
    euros += (Number(p.gas_consumption) * savingCentsPerKwh) / 100
  }
  if (euros === 0) euros = 350
  return Math.max(150, Math.min(900, Math.round(euros)))
}

export async function GET(req: Request) {
  return jsonWithCors(req, { error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
}
