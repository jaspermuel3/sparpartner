import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

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
}

export async function POST(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

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
    await supabase.auth.signOut()
  } catch {
  }

  const formData = await request.formData().catch(() => null)
  const nextRaw = formData ? String(formData.get('next') ?? '') : ''
  const next = (nextRaw.startsWith('/login') ? nextRaw : '') || '/login'

  const redirectUrl = request.nextUrl.clone()
  const [path, query] = next.split('?')
  redirectUrl.pathname = path || '/login'
  if (query) {
    const sp = new URLSearchParams(query)
    sp.forEach((v, k) => redirectUrl.searchParams.set(k, v))
  }
  const redirect = NextResponse.redirect(redirectUrl, { status: 303 })

  for (const c of response.cookies.getAll()) redirect.cookies.set(c)
  clearAuthCookies(redirect)

  return redirect
}
