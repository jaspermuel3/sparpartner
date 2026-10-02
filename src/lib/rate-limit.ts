/* ============================================================
   Einfaches In-Memory Rate Limiting (Zero-Dependency)
   ------------------------------------------------------------
   - Identifiziert Clients per IP (X-Forwarded-For, fallback Remote-IP)
   - Token-Bucket pro Key
   - Single-Node tauglich; bei Multi-Node/Serverless unbedingt
     später auf Redis/Upstash umstellen (gleiches Interface)
   ============================================================ */

import { log } from './logging'

type Bucket = { tokens: number; lastRefill: number }

export type RateLimitConfig = {
  max: number
  windowMs: number
  refillIntervalMs?: number
}

const STORE: Map<string, Bucket> = new Map()

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  login: { max: 8, windowMs: 10 * 60 * 1000 }, // 8 Versuche / 10 min
  publicLeads: { max: 60, windowMs: 60 * 1000 }, // 60 / min (pro IP)
  generic: { max: 240, windowMs: 60 * 1000 },
}

function getClientIp(req: Request | { headers: Headers }): string {
  try {
    const h = req.headers
    const xff = h.get('x-forwarded-for')
    if (xff) {
      const first = xff.split(',')[0]?.trim()
      if (first) return first
    }
    const xr = h.get('x-real-ip')
    if (xr) return xr.trim()
  } catch {}
  return 'unknown-client'
}

function nowMs(): number {
  return Date.now()
}

export type RateLimitResult = {
  ok: boolean
  status: number
  retryAfterMs: number
  limit: number
  remaining: number
}

export function rateLimit(
  req: Request | { headers: Headers },
  scope: keyof typeof DEFAULT_CONFIGS | string,
  custom?: RateLimitConfig,
  extraKey: string = '',
): RateLimitResult {
  const cfg: RateLimitConfig = custom ?? (DEFAULT_CONFIGS[scope] || DEFAULT_CONFIGS.generic)
  const clientIp = getClientIp(req)
  const key = `${scope}:${clientIp}:${extraKey}`

  let bucket = STORE.get(key)
  if (!bucket) {
    bucket = { tokens: cfg.max, lastRefill: nowMs() }
    STORE.set(key, bucket)
  }

  const now = nowMs()
  const elapsed = Math.max(0, now - bucket.lastRefill)
  const interval = cfg.refillIntervalMs ?? cfg.windowMs
  const refilled = Math.floor(elapsed / interval) * Math.max(1, Math.floor(cfg.max))
  if (refilled > 0) {
    bucket.tokens = Math.min(cfg.max, bucket.tokens + refilled)
    bucket.lastRefill = now
  }

  if (bucket.tokens <= 0) {
    const retryAfterMs = Math.max(0, interval - elapsed)
    log.warn(
      'RATE_LIMIT',
      'Anfrage blockiert',
      { scope, clientIp, retryAfterMs, limit: cfg.max },
    )
    return {
      ok: false,
      status: 429,
      retryAfterMs,
      limit: cfg.max,
      remaining: 0,
    }
  }

  bucket.tokens -= 1
  return {
    ok: true,
    status: 200,
    retryAfterMs: 0,
    limit: cfg.max,
    remaining: bucket.tokens,
  }
}

const cfg_max_fail_tokens = 20

/** Rate-Limit Wrapper, der zusätzlich bei Login nach falschem Passwort verlangsamt. */
export function loginThrottle(
  req: Request | { headers: Headers },
  emailKey: string,
): { waitMs: number; blocked: boolean } {
  const ipRes = rateLimit(req, 'login')
  if (!ipRes.ok) return { waitMs: ipRes.retryAfterMs, blocked: true }

  const key = `login-fail:${emailKey.toLowerCase()}`
  const ex = STORE.get(key)
  if (!ex) {
    STORE.set(key, { tokens: cfg_max_fail_tokens, lastRefill: nowMs() })
    return { waitMs: 0, blocked: false }
  }
  const fails = Math.max(0, cfg_max_fail_tokens - ex.tokens)
  const waitMs = fails < 3 ? 0 : Math.min(3_000, (fails - 2) * 500)
  return { waitMs, blocked: false }
}

export function recordLoginFailure(emailKey: string) {
  const key = `login-fail:${emailKey.toLowerCase()}`
  const cur = STORE.get(key)
  STORE.set(key, {
    tokens: Math.max(0, (cur?.tokens ?? cfg_max_fail_tokens) - 1),
    lastRefill: nowMs(),
  })
}

export function recordLoginSuccess(emailKey: string) {
  const key = `login-fail:${emailKey.toLowerCase()}`
  STORE.delete(key)
}
