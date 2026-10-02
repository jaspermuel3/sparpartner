import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSupabaseUrl, getSupabaseAnonKey, stripBomAndWs } from '@/lib/supabase/_sanitize'

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const c of from.cookies.getAll()) {
    try { to.cookies.set(c) } catch {}
  }
  return to
}

export async function POST(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })
  const loginRedirect = request.nextUrl.clone()
  loginRedirect.pathname = '/login'

  try {
    const formData = await request.formData().catch(() => null)

    if (!formData) {
      loginRedirect.searchParams.set('next', '/dashboard')
      loginRedirect.searchParams.set('error', 'Ungültige Anfrage.')
      return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
    }

    const email = String(formData.get('email') ?? '').trim()
    const password = stripBomAndWs(String(formData.get('password') ?? ''))
    const nextRaw = String(formData.get('next') ?? '/dashboard') || '/dashboard'
    const next = nextRaw.startsWith('/') ? nextRaw : '/dashboard'

    loginRedirect.searchParams.set('next', next)

    if (!email || !password) {
      loginRedirect.searchParams.set('error', 'Bitte E-Mail und Passwort eingeben.')
      return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
    }

    if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
      loginRedirect.searchParams.set('error', 'Server-Konfiguration unvollständig. Supabase-URL oder Anon-Key fehlen.')
      return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
    }

    const admin = createAdminClient()

    const supabase = createServerClient(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            try { response.cookies.set({ name, value, ...options }) } catch {}
          },
          remove(name: string, options: CookieOptions) {
            try { response.cookies.set({ name, value: '', ...options, maxAge: 0, expires: new Date(0) }) } catch {}
          },
        },
      },
    )

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !signInData?.session) {
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
      loginRedirect.searchParams.set('error', 'Sitzung konnte nicht gespeichert werden.')
      return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
    }

    const { data: { user: authUser }, error: getUserErr } = await supabase.auth.getUser()
    if (getUserErr || !authUser) {
      loginRedirect.searchParams.set('error', 'Benutzer konnte nicht ausgelesen werden.')
      return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
    }

    let { data: dbUser } = await admin
      .from('users')
      .select('id, role, is_active, last_login_at, full_name')
      .eq('id', authUser.id)
      .limit(1)
      .maybeSingle()

    if (!dbUser) {
      const fallbackRole =
        (authUser.email ?? '').toLowerCase().includes('admin') ? 'admin' : 'seller'
      const fallbackFullName =
        (authUser.user_metadata?.full_name as string) ||
        (authUser.user_metadata?.name as string) ||
        (authUser.email ? authUser.email.split('@')[0] : 'Benutzer')

      try {
        // Versuch 1: Direktes Insert via Supabase JS
        let inserted = false
        try {
          const { data: created, error: createErr } = await admin
            .from('users')
            .insert({
              id: authUser.id,
              full_name: fallbackFullName,
              role: fallbackRole as any,
              is_active: true,
            })
            .select('id, role, is_active, last_login_at, full_name')
            .limit(1)
            .maybeSingle()

          if (!createErr && created) {
            dbUser = created
            inserted = true
          }
        } catch {}

        // Versuch 2: Enum-safe via RPC public.ensure_public_user_exists(...)
        // (definiert in Migration 0016)
        if (!inserted) {
          try {
            const rpc: any = await admin
              .rpc('ensure_public_user_exists', {
                p_auth_id: authUser.id,
                p_fallback_name: fallbackFullName,
                p_fallback_role: fallbackRole,
              })
              .limit(1)
              .maybeSingle()

            if (rpc && rpc.data) dbUser = rpc.data as any
          } catch {}
        }

        // Versuch 3: Fallback Query – falls Reparatur-Skript parallel schon lief
        if (!dbUser) {
          try {
            const { data: retry } = await admin
              .from('users')
              .select('id, role, is_active, last_login_at, full_name')
              .eq('id', authUser.id)
              .limit(1)
              .maybeSingle()
            if (retry) dbUser = retry
          } catch {}
        }

        try {
          // Typ-Sicher: reines INSERT im try/catch.
          // Falls für user_id bereits ein Wallet existiert → Unique-Constraint-Error
          // wird von catch {} abgefangen und ignoriert.
          // (Verhält sich identisch zu alter Variante mit .onConflict + .ignore(),
          //  umgeht aber den TS2339 Build-Fehler "Property 'onConflict' does not
          //  exist on type PostgrestFilterBuilder" bei Supabase JS v2 + strengen
          //  generierten DB-Typen)
          await admin
            .from('token_wallets')
            .insert({ user_id: authUser.id, balance: fallbackRole === 'admin' ? 100 : 0 })
        } catch {}
      } catch {}
    }

    if (!dbUser) {
      await supabase.auth.signOut()
      loginRedirect.searchParams.set('error', 'Benutzerprofil nicht gefunden.')
      return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
    }

    if (!dbUser.is_active) {
      await supabase.auth.signOut()
      loginRedirect.searchParams.set('error', 'inactive')
      return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
    }

    if (dbUser.last_login_at) {
      try {
        const cookiePayload = JSON.stringify({
          at: dbUser.last_login_at,
          email: authUser.email ?? null,
          full_name: dbUser.full_name ?? null,
        })
        response.cookies.set({
          name: 'crm:last_login_context',
          value: encodeURIComponent(cookiePayload),
          path: '/',
          httpOnly: false,
          sameSite: 'lax',
          maxAge: 60,
        })
      } catch {}
    }

    try {
      await admin
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', authUser.id)
    } catch {}

    let safeNext = next
    const isAdmin = dbUser.role === 'admin'
    const isSellerOrAdmin = dbUser.role === 'seller' || isAdmin

    if (safeNext.startsWith('/admin') && !isAdmin) {
      safeNext = '/dashboard'
    }
    const salesPrefixes = ['/dashboard', '/request-lead', '/my-leads', '/callbacks', '/stats', '/settings']
    const isSales = salesPrefixes.some((p) => safeNext.startsWith(p)) || safeNext.startsWith('/admin/')
    if (isSales && !isSellerOrAdmin) {
      safeNext = '/login'
    }
    if (isAdmin && (safeNext === '/dashboard' || safeNext === '/')) {
      safeNext = '/admin/dashboard'
    }

    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = safeNext
    return copyCookies(response, NextResponse.redirect(redirectUrl, { status: 303 }))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    loginRedirect.searchParams.set('error', msg)
    return copyCookies(response, NextResponse.redirect(loginRedirect, { status: 303 }))
  }
}
