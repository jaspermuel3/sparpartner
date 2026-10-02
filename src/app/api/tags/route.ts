import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase/_sanitize'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const response = NextResponse.next({ request: { headers: request.headers } })
    const anonUrl = getSupabaseUrl()
    const anonKey = getSupabaseAnonKey()
    if (!anonUrl || !anonKey) {
      return NextResponse.json([])
    }
    const supabase = createServerClient(anonUrl, anonKey, {
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json([])
    }
    const admin = createAdminClient()
    const { data } = await admin
      .from('tags')
      .select('id, name, color')
      .order('name', { ascending: true })
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json([])
  }
}
