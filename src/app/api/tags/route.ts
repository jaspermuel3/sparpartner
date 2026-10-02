import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase/_sanitize'
import { log, tryLog } from '@/lib/logging'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } })

  try {
    const anonUrl = getSupabaseUrl()
    const anonKey = getSupabaseAnonKey()
    if (!anonUrl || !anonKey) {
      log.error('TAGS', 'Supabase-Konfiguration unvollständig (URL/Anon-Key fehlen)')
      return NextResponse.json([], { status: 500 })
    }

    const supabase = createServerClient(anonUrl, anonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try { response.cookies.set({ name, value, ...options }) } catch (e) {
            log.warn('TAGS', 'Cookie set fehlgeschlagen', undefined, e as Error)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            response.cookies.set({ name, value: '', ...options, maxAge: 0, expires: new Date(0) })
          } catch (e) {
            log.warn('TAGS', 'Cookie remove fehlgeschlagen', undefined, e as Error)
          }
        },
      },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      log.warn('TAGS', 'Ungültiger Zugriff: nicht eingeloggter User')
      return NextResponse.json([], { status: 401 })
    }

    await tryLog('TAGS', undefined, async () => {
      await requireUser()
      return undefined
    }, 'requireUser Gate auf /api/tags')

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('tags')
      .select('id, name, color')
      .order('name', { ascending: true })

    if (error) {
      log.error('TAGS', 'Tags konnten nicht geladen werden', undefined, error)
      return NextResponse.json([], { status: 500 })
    }

    log.info('TAGS', 'Tags erfolgreich geladen', { user_id: user.id, count: (data ?? []).length })
    return NextResponse.json(data ?? [])
  } catch (err) {
    log.error('TAGS', 'Unbehandelte Exception in /api/tags', undefined, err as Error)
    return NextResponse.json([], { status: 500 })
  }
}
