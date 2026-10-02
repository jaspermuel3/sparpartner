/* ============================================================
   Zentraler Auth-/Login-Helper.
   ------------------------------------------------------------
   Konsolidiert gemeinsame Logik, die sowohl in:
   - Server Action `loginAction` (src/app/actions.ts)
   - API Route     POST /api/auth/login  (src/app/api/auth/login/route.ts)
   benötigt wird, sodass beide Flows IDENTISCH entscheiden.
   ============================================================ */

import { createClient } from './supabase/server'
import { createAdminClient } from './supabase/admin'
import { log, tryLog } from './logging'
import { validateLeadField as _val, validatePasswordPolicy, isValidEmail } from './validation'

export type AuthenticatedUser = {
  auth_id: string
  email: string | undefined
  db_id: string
  role: 'seller' | 'admin' | string
  is_active: boolean
  last_login_at: string | null
  full_name: string | null
}

type DbUserRow = {
  id: string
  role: 'seller' | 'admin' | string
  is_active: boolean
  last_login_at: string | null
  full_name: string | null
}

export type LoginFlowError = {
  kind: 'redirect'
  message: string
}

export type LoginFlowResult = {
  ok: boolean
  user?: AuthenticatedUser
  error?: LoginFlowError
  /**
   * Cookies müssen vom Aufrufer an die finale Response angehängt werden.
   * Das `supabase`-Client-Objekt wurde mit demselben Cookie-Adapter
   * erstellt, den der Aufrufer initialisiert hat.
   */
  supabase?: ReturnType<typeof createClient>
  nextOverride?: string
}

function normalizeNext(nextRaw: string): string {
  const next = (nextRaw || '/dashboard').trim() || '/dashboard'
  if (!next.startsWith('/')) return '/dashboard'
  return next
}

function redirectAfter(
  user: AuthenticatedUser,
  requestedNext: string,
): string {
  let safeNext = requestedNext
  const isAdmin = user.role === 'admin'
  const isSellerOrAdmin = user.role === 'seller' || isAdmin

  if (safeNext.startsWith('/admin') && !isAdmin) safeNext = '/dashboard'
  const salesPrefixes = ['/dashboard', '/request-lead', '/my-leads', '/callbacks', '/stats', '/settings']
  const isSales = salesPrefixes.some((p) => safeNext.startsWith(p)) || safeNext.startsWith('/admin/')
  if (isSales && !isSellerOrAdmin) safeNext = '/login'
  if (isAdmin && (safeNext === '/dashboard' || safeNext === '/')) safeNext = '/admin/dashboard'
  return safeNext
}

/**
 * Basis-Login-Flow. Der Aufrufer ist verantwortlich für:
 *  - Supabase-Server-Client MIT eigenem Cookie-Adapter zu bauen
 *  - `authClientRef.supabase` nach Return in die Response zu übernehmen
 *    (die Auth-Cookies werden bereits in `setSession` geschrieben, der
 *    Adapter hängt sie an die vom Aufrufer bereitgestellte Response an).
 */
export async function runLoginFlow(input: {
  email: string
  password: string
  next: string
  createSupabase: () => ReturnType<typeof createClient>
  validateBeforeSignIn?: boolean
}): Promise<LoginFlowResult> {
  const email = (input.email || '').trim().toLowerCase()
  const password = input.password || ''
  const requestedNext = normalizeNext(input.next)

  const fail = (message: string): LoginFlowResult => ({
    ok: false,
    error: { kind: 'redirect', message },
  })

  if (!email || !password) return fail('Bitte E-Mail und Passwort eingeben.')
  if (!isValidEmail(email)) return fail('Ungültige E-Mail-Adresse.')
  if (password.length > 128) return fail('E-Mail oder Passwort ist falsch.')
  if (input.validateBeforeSignIn) {
    const pw = validatePasswordPolicy(password)
    if (!pw.ok) return fail('E-Mail oder Passwort ist falsch.')
  }

  const supabase = input.createSupabase()
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError || !signInData?.session) {
    log.warn('AUTH', 'Login (runLoginFlow): Credentials ungültig', { email }, signInError)
    const generic = signInError?.message?.toLowerCase()
    const wrong = generic?.includes('invalid') || generic?.includes('credentials')
    return fail(wrong ? 'E-Mail oder Passwort ist falsch.' : signInError?.message ?? 'Anmeldung fehlgeschlagen.')
  }

  const { error: setSessionErr } = await supabase.auth.setSession({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
  })
  if (setSessionErr) {
    log.warn('AUTH', 'setSession fehlgeschlagen nach Login', undefined, setSessionErr)
    return fail('Sitzung konnte nicht gespeichert werden.')
  }

  const { data: { user: authUser }, error: getUserErr } = await supabase.auth.getUser()
  if (getUserErr || !authUser) return fail('Benutzer konnte nicht ausgelesen werden.')

  const admin = createAdminClient()
  const { data: fetchedDb } = await admin
    .from('users')
    .select('id, role, is_active, last_login_at, full_name')
    .eq('id', authUser.id)
    .limit(1)
    .maybeSingle()

  let dbUser = fetchedDb as DbUserRow | null

  if (!dbUser) {
    const fallbackRole = email.includes('admin') ? 'admin' : 'seller'
    const fallbackFullName =
      (authUser.user_metadata?.full_name as string | undefined) ||
      (authUser.user_metadata?.name as string | undefined) ||
      (email ? email.split('@')[0] : 'Benutzer')

    let inserted = false
    try {
      const { data: created, error: createErr } = await admin
        .from('users')
        .insert({ id: authUser.id, full_name: fallbackFullName, role: fallbackRole as unknown as 'seller', is_active: true })
        .select('id, role, is_active, last_login_at, full_name')
        .limit(1)
        .maybeSingle()
      if (!createErr && created) { dbUser = created as DbUserRow; inserted = true }
    } catch (e) { log.warn('AUTH', 'Fallback-User-Insert direkt fehlgeschlagen', undefined, e) }

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
      await admin.from('token_wallets').insert({ user_id: authUser.id, balance: fallbackRole === 'admin' ? 100 : 0 })
      return undefined
    }, 'token_wallets Insert bei neuem User')
  }

  if (!dbUser) {
    await tryLog('AUTH', undefined, () => supabase.auth.signOut(), 'signOut nach fehlendem DB-User')
    return fail('Benutzerprofil nicht gefunden.')
  }

  if (!dbUser.is_active) {
    await tryLog('AUTH', undefined, () => supabase.auth.signOut(), 'signOut bei inactive User')
    return fail('inactive')
  }

  const resultUser: AuthenticatedUser = {
    auth_id: authUser.id,
    email: authUser.email ?? email,
    db_id: dbUser.id,
    role: dbUser.role,
    is_active: dbUser.is_active,
    last_login_at: dbUser.last_login_at,
    full_name: dbUser.full_name,
  }

  log.info('AUTH', 'Login (runLoginFlow) erfolgreich', {
    email: resultUser.email,
    role: resultUser.role,
    user_id: resultUser.db_id,
  })

  await tryLog('AUTH', undefined, async () => {
    await admin.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', resultUser.db_id)
    return undefined
  }, 'last_login_at Update')

  return {
    ok: true,
    user: resultUser,
    supabase,
    nextOverride: redirectAfter(resultUser, requestedNext),
  }
}

export { validateLeadField as validateLeadInlineField } from './validation'
