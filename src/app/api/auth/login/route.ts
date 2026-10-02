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

    const { data: dbUser } = await admin
      .from('users')
      .select('id, role, is_active')
      .eq('id', authUser.id)
      .limit(1)
      .maybeSingle()

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
