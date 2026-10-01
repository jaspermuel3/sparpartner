import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'

const PUBLIC_ROUTES = ['/login', '/auth/callback', '/api/auth', '/favicon.ico']
const SALES_ROUTES_PREFIXES = ['/dashboard', '/request-lead', '/my-leads', '/callbacks', '/stats', '/settings', '/leads/']
const ADMIN_ROUTES_PREFIXES = ['/admin']

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const c of from.cookies.getAll()) {
    try { to.cookies.set(c) } catch {}
  }
  return to
}

function createMiddlewareClient(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null as any

  return createServerClient(url, key, {
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
  })
}

function clearAuthCookies(response: NextResponse) {
  const baseOpts = { httpOnly: true, sameSite: 'lax' as const, path: '/' }
  const keyPrefix = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20) ?? ''
  const hostPrefix = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, '').replace(/\./g, '-') ?? ''
  const names = [
    'sb-access-token',
    'sb-refresh-token',
    keyPrefix ? `sb-${keyPrefix}-access-token` : '',
    keyPrefix ? `sb-${keyPrefix}-refresh-token` : '',
    hostPrefix ? `sb-${hostPrefix}-auth-token` : '',
  ].filter(Boolean)
  for (const name of names) {
    try {
      response.cookies.set({
        name,
        value: '',
        maxAge: 0,
        expires: new Date(0),
        ...baseOpts,
      })
    } catch {}
  }
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) || pathname === '/') {
    return NextResponse.next({ request: { headers: request.headers } })
  }

  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createMiddlewareClient(request, response)
  if (!supabase) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('error', 'Server-Konfiguration unvollständig. Supabase-URL oder Anon-Key fehlen.')
    const redirect = NextResponse.redirect(redirectUrl)
    copyCookies(response, redirect)
    return clearAuthCookies(redirect)
  }

  let authUser = null
  try {
    const { data } = await supabase.auth.getUser()
    authUser = data.user
  } catch {
    authUser = null
  }

  if (!authUser) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('next', pathname)
    const redirect = NextResponse.redirect(redirectUrl)
    copyCookies(response, redirect)
    return clearAuthCookies(redirect)
  }

  let dbUser = null
  try {
    const admin = createAdminClient()
    const res = await admin
      .from('users')
      .select('id, role, is_active')
      .eq('id', authUser.id)
      .limit(1)
      .maybeSingle()
    dbUser = res.data
  } catch {
    dbUser = null
  }

  if (!dbUser || !dbUser.is_active) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('error', 'inactive')
    const redirect = NextResponse.redirect(redirectUrl)
    copyCookies(response, redirect)
    return clearAuthCookies(redirect)
  }

  const isAdminRoute = ADMIN_ROUTES_PREFIXES.some((p) => pathname.startsWith(p))
  if (isAdminRoute && dbUser.role !== 'admin') {
    const redirect = NextResponse.redirect(new URL('/dashboard', request.url))
    return copyCookies(response, redirect)
  }

  const isSalesRoute = SALES_ROUTES_PREFIXES.some((p) => pathname.startsWith(p))
  if (isSalesRoute && !(dbUser.role === 'seller' || dbUser.role === 'admin')) {
    const redirect = NextResponse.redirect(new URL('/login', request.url))
    copyCookies(response, redirect)
    return clearAuthCookies(redirect)
  }

  response.headers.set('x-user-role', dbUser.role)
  response.headers.set('x-user-id', dbUser.id)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
}
