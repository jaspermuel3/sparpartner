import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase/_sanitize'
import { log, tryLog } from '@/lib/logging'
import {
  rateLimit,
  loginThrottle,
  recordLoginFailure,
  recordLoginSuccess,
} from '@/lib/rate-limit'
import { validatePasswordPolicy, isValidEmail } from '@/lib/validation'
import { isProd } from '@/lib/env'

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const c of from.cookies.getAll()) {
    try { to.cookies.set(c) } catch {}
  }
  return to
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function applyRateLimitHeaders(init: ResponseInit, result: { limit: number; remaining: number }): ResponseInit {
  const h = new Headers(init.headers ?? {})
  h.set('X-RateLimit-Limit', String(result.limit))
  h.set('X-RateLimit-Remaining', String(result.remaining))
  return { ...init, headers: h }
}

export async function POST(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })
  const loginRedirect = request.nextUrl.clone()
  loginRedirect.pathname = '/login'

  // ---------- Rate-Limit (IP-basiert) ----------
  const ipLimit = rateLimit(request, 'login')
  if (!ipLimit.ok) {
    const secs = Math.max(1, Math.ceil(ipLimit.retryAfterMs / 1000))
    loginRedirect.searchParams.set('error', 'ZU_VIELE_VERSUCHE')
    loginRedirect.searchParams.set('retry_after', String(secs))
    const res = NextResponse.redirect(loginRedirect, { status: 303 })
    res.headers.set('Retry-After', String(secs))
    return copyCookies(response, res)
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    loginRedirect.searchParams.set('next', '/dashboard')
    loginRedirect.searchParams.set('error', 'Ungültige Anfrage.')
    return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
  }

  const emailRaw = String(formData.get('email') ?? '').trim()
  const email = emailRaw.toLowerCase()
  const password = String(formData.get('password') ?? '')
  const nextRaw = String(formData.get('next') ?? '/dashboard') || '/dashboard'
  const next = nextRaw.startsWith('/') ? nextRaw : '/dashboard'

  loginRedirect.searchParams.set('next', next)

  // ---------- Throttle je E-Mail (verzögert bei bekannten Fehlversuchen) ----------
  const throttle = loginThrottle(request, email || 'unknown-email')
  if (throttle.blocked) {
    loginRedirect.searchParams.set('error', 'ZU_VIELE_VERSUCHE')
    const res = NextResponse.redirect(loginRedirect, { status: 303 })
    res.headers.set('Retry-After', String(Math.max(1, Math.ceil(throttle.waitMs / 1000))))
    return copyCookies(response, res)
  }
  if (throttle.waitMs > 0) {
    await sleep(throttle.waitMs)
  }

  try {
    if (!email || !password) {
      if (email) recordLoginFailure(email)
      loginRedirect.searchParams.set('error', 'Bitte E-Mail und Passwort eingeben.')
      return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
    }

    if (!isValidEmail(email)) {
      recordLoginFailure(email)
      loginRedirect.searchParams.set('error', 'Ungültige E-Mail-Adresse.')
      return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
    }

    // Hinweis: Keinen Fehler wegen zu kurzem Passwort VOR dem Auth-Check zurückgeben,
    // sonst lässt sich die Länge gültiger Passwörter raten. Stattdessen validieren wir
    // NUR auf zu lang (max 128 Zeichen) – OWASP-Guideline.
    if (password.length > 128) {
      recordLoginFailure(email)
      loginRedirect.searchParams.set('error', 'E-Mail oder Passwort ist falsch.')
      return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
    }

    if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
      loginRedirect.searchParams.set('error', 'Server-Konfiguration unvollständig. Supabase-URL oder Anon-Key fehlen.')
      const errInit = applyRateLimitHeaders({ status: 303 }, ipLimit)
      return copyCookies(response, NextResponse.redirect(loginRedirect, errInit))
    }

    const admin = createAdminClient()

    const supabase = createServerClient(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) {
            try { response.cookies.set({ name, value, ...options }) } catch {}
          },
          remove(name: string, options: CookieOptions) {
            try {
              response.cookies.set({
                name,
                value: '',
                ...options,
                maxAge: 0,
                expires: new Date(0),
              })
            } catch {}
          },
        },
      },
    )

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !signInData?.session) {
      recordLoginFailure(email)
      log.warn(
        'AUTH',
        'Login fehlgeschlagen',
        { email },
        signInError,
      )
      const msg =
        signInError?.message?.toLowerCase().includes('invalid') ||
        signInError?.message?.toLowerCase().includes('credentials')
          ? 'E-Mail oder Passwort ist falsch.'
          : signInError?.message ?? 'Anmeldung fehlgeschlagen.'
      loginRedirect.searchParams.set('error', msg)
      return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
    }

    const { error: setSessionErr } = await supabase.auth.setSession({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    })

    if (setSessionErr) {
      recordLoginFailure(email)
      log.warn('AUTH', 'Session konnte nach signIn nicht gespeichert werden', undefined, setSessionErr)
      loginRedirect.searchParams.set('error', 'Sitzung konnte nicht gespeichert werden.')
      return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
    }

    const { data: { user: authUser }, error: getUserErr } = await supabase.auth.getUser()
    if (getUserErr || !authUser) {
      recordLoginFailure(email)
      loginRedirect.searchParams.set('error', 'Benutzer konnte nicht ausgelesen werden.')
      return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
    }

    type DbUserRow = {
      id: string
      role: 'seller' | 'admin' | string
      is_active: boolean
      last_login_at: string | null
      full_name: string | null
    }

    let dbUser: DbUserRow | null = null

    const dbRes = await admin
      .from('users')
      .select('id, role, is_active, last_login_at, full_name')
      .eq('id', authUser.id)
      .limit(1)
      .maybeSingle()
    dbUser = (dbRes.data ?? null) as DbUserRow | null

    if (!dbUser) {
      // Fallback: Benutzer in der lokalen users-Tabelle anlegen (Synchronisation mit auth.users)
      const fallbackRole =
        (authUser.email ?? '').toLowerCase().includes('admin') ? 'admin' : 'seller'
      const fallbackFullName =
        (authUser.user_metadata?.full_name as string | undefined) ||
        (authUser.user_metadata?.name as string | undefined) ||
        (authUser.email ? authUser.email.split('@')[0] : 'Benutzer')

      let inserted = false
      try {
        const created = await admin
          .from('users')
          .insert({
            id: authUser.id,
            full_name: fallbackFullName,
            role: fallbackRole as unknown as 'seller',
            is_active: true,
          })
          .select('id, role, is_active, last_login_at, full_name')
          .limit(1)
          .maybeSingle()
        if (!created.error && created.data) {
          dbUser = created.data as DbUserRow
          inserted = true
        }
      } catch (e) { log.warn('AUTH', 'Direkter User-Insert fehlgeschlagen, versuche RPC', undefined, e) }

      if (!inserted) {
        try {
          const rpc = await admin
            .rpc('ensure_public_user_exists', {
              p_auth_id: authUser.id,
              p_fallback_name: fallbackFullName,
              p_fallback_role: fallbackRole,
            })
            .limit(1)
            .maybeSingle()
          if (rpc && rpc.data) dbUser = rpc.data as DbUserRow
        } catch (e) { log.warn('AUTH', 'ensure_public_user_exists RPC fehlgeschlagen', undefined, e) }
      }

      if (!dbUser) {
        try {
          const retry = await admin
            .from('users')
            .select('id, role, is_active, last_login_at, full_name')
            .eq('id', authUser.id)
            .limit(1)
            .maybeSingle()
          if (retry.data) dbUser = retry.data as DbUserRow
        } catch {}
      }

      await tryLog('AUTH', undefined, async () => {
        await admin
          .from('token_wallets')
          .insert({ user_id: authUser.id, balance: fallbackRole === 'admin' ? 100 : 0 })
        return undefined
      }, 'token_wallets Insert (Duplicate wird ignoriert)')
    }

    if (!dbUser) {
      await tryLog('AUTH', undefined, () => supabase.auth.signOut(), 'signOut nach fehlender User-Zuordnung')
      recordLoginFailure(email)
      loginRedirect.searchParams.set('error', 'Benutzerprofil nicht gefunden.')
      return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
    }

    if (!dbUser.is_active) {
      await tryLog('AUTH', undefined, () => supabase.auth.signOut(), 'signOut bei inactive User')
      recordLoginFailure(email)
      loginRedirect.searchParams.set('error', 'inactive')
      return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
    }

    if (dbUser.last_login_at) {
      const cookiePayload = JSON.stringify({
        at: dbUser.last_login_at,
        email: authUser.email ?? null,
        full_name: dbUser.full_name ?? null,
      })
      try {
        response.cookies.set({
          name: 'crm:last_login_context',
          value: encodeURIComponent(cookiePayload),
          path: '/',
          httpOnly: true,
          secure: isProd(),
          sameSite: 'lax',
          maxAge: 60,
        })
      } catch {}
    }

    await tryLog('AUTH', undefined, async () => {
      await admin
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', authUser.id)
      return undefined
    }, 'last_login_at update')

    recordLoginSuccess(email)
    log.info('AUTH', 'Login erfolgreich', {
      user_id: authUser.id,
      role: dbUser.role,
      email,
    })

    let safeNext = next
    const isAdmin = dbUser.role === 'admin'
    const isSellerOrAdmin = dbUser.role === 'seller' || isAdmin

    if (safeNext.startsWith('/admin') && !isAdmin) safeNext = '/dashboard'
    const salesPrefixes = ['/dashboard', '/request-lead', '/my-leads', '/callbacks', '/stats', '/settings']
    const isSales = salesPrefixes.some((p) => safeNext.startsWith(p)) || safeNext.startsWith('/admin/')
    if (isSales && !isSellerOrAdmin) safeNext = '/login'
    if (isAdmin && (safeNext === '/dashboard' || safeNext === '/')) safeNext = '/admin/dashboard'

    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = safeNext
    return copyCookies(response, NextResponse.redirect(redirectUrl, { status: 303 }))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error('AUTH', 'Unbehandelte Exception im Login-Flow', { email }, err)
    loginRedirect.searchParams.set('error', msg)
    return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
  }
}
