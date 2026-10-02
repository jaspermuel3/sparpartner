/* ============================================================
   Einfaches In-Memory Rate Limiting (Zero-Dependency)
   ------------------------------------------------------------
   - Identifiziert Clients per IP (X-Forwarded-For, fallback Remote-IP)
   - Token-Bucket pro Key mit kontinuierlichem Refill
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
  login: { max: 25, windowMs: 10 * 60 * 1000, refillIntervalMs: 30 * 1000 },
  publicLeads: { max: 60, windowMs: 60 * 1000, refillIntervalMs: 1_000 },
  generic: { max: 240, windowMs: 60 * 1000, refillIntervalMs: 1_000 },
}

const LOGIN_FAIL_CONFIG: RateLimitConfig = {
  max: 20,
  windowMs: 30 * 60 * 1000,
  refillIntervalMs: 2 * 60 * 1000,
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

function refillBucket(bucket: Bucket, cfg: RateLimitConfig): void {
  const now = nowMs()
  const interval = cfg.refillIntervalMs ?? Math.max(1_000, Math.floor(cfg.windowMs / cfg.max))
  const tokensPerInterval = Math.max(1, Math.ceil((cfg.max * interval) / cfg.windowMs))
  const elapsed = Math.max(0, now - bucket.lastRefill)
  const intervals = Math.floor(elapsed / interval)
  if (intervals > 0) {
    bucket.tokens = Math.min(cfg.max, bucket.tokens + intervals * tokensPerInterval)
    bucket.lastRefill += intervals * interval
  }
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

  refillBucket(bucket, cfg)

  if (bucket.tokens <= 0) {
    const interval = cfg.refillIntervalMs ?? Math.max(1_000, Math.floor(cfg.windowMs / cfg.max))
    const elapsed = nowMs() - bucket.lastRefill
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

export function loginThrottle(
  req: Request | { headers: Headers },
  emailKey: string,
): { waitMs: number; blocked: boolean; ipRemaining: number; failRemaining: number } {
  const ipRes = rateLimit(req, 'login')
  if (!ipRes.ok) return { waitMs: ipRes.retryAfterMs, blocked: true, ipRemaining: 0, failRemaining: 0 }

  const emailNorm = emailKey.toLowerCase()
  const failKey = `login-fail:${emailNorm}`
  let bucket = STORE.get(failKey)
  if (!bucket) {
    bucket = { tokens: LOGIN_FAIL_CONFIG.max, lastRefill: nowMs() }
    STORE.set(failKey, bucket)
  }
  refillBucket(bucket, LOGIN_FAIL_CONFIG)

  const fails = Math.max(0, LOGIN_FAIL_CONFIG.max - bucket.tokens)
  const waitMs = fails < 3 ? 0 : Math.min(3_000, (fails - 2) * 500)

  return { waitMs, blocked: false, ipRemaining: ipRes.remaining, failRemaining: bucket.tokens }
}

export function recordLoginFailure(emailKey: string) {
  const emailNorm = emailKey.toLowerCase()
  const key = `login-fail:${emailNorm}`
  const cur = STORE.get(key)
  STORE.set(key, {
    tokens: Math.max(0, (cur?.tokens ?? LOGIN_FAIL_CONFIG.max) - 1),
    lastRefill: cur?.lastRefill ?? nowMs(),
  })
}

export function recordLoginSuccess(emailKey: string) {
  const emailNorm = emailKey.toLowerCase()
  const key = `login-fail:${emailNorm}`
  STORE.delete(key)
}
