import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const c of from.cookies.getAll()) to.cookies.set(c)
  return to
}

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null)
  const loginRedirect = request.nextUrl.clone()
  loginRedirect.pathname = '/login'

  if (!formData) {
    loginRedirect.searchParams.set('next', '/dashboard')
    loginRedirect.searchParams.set('error', 'Ungültige Anfrage.')
    return NextResponse.redirect(loginRedirect, { status: 303 })
  }

  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const nextRaw = String(formData.get('next') ?? '/dashboard') || '/dashboard'
  const next = nextRaw.startsWith('/') ? nextRaw : '/dashboard'

  loginRedirect.searchParams.set('next', next)

  if (!email || !password) {
    loginRedirect.searchParams.set('error', 'Bitte E-Mail und Passwort eingeben.')
    return NextResponse.redirect(loginRedirect, { status: 303 })
  }

  let response = NextResponse.next({ request: { headers: request.headers } })
  const admin = createAdminClient()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  try {
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
