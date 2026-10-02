import { createClient } from './supabase/server'
import { createAdminClient } from './supabase/admin'
import { getTokenWallet } from './services/tokens.service'
import type { DatabaseUser, UserRole } from '@/types'

export const getUserWallet = getTokenWallet

export async function getCurrentUser(): Promise<(DatabaseUser & { auth_email: string | undefined }) | null> {
  try {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return null

    const admin = createAdminClient()
    const { data: dbUser } = await admin
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .limit(1)
      .maybeSingle()

    if (!dbUser) return null
    return { ...(dbUser as DatabaseUser), auth_email: authUser.email }
  } catch {
    return null
  }
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error('UNAUTHENTICATED')
  if (!user.is_active) throw new Error('USER_INACTIVE')
  return user
}

export async function requireRole(role: UserRole | UserRole[]) {
  const user = await requireUser()
  const allowed = Array.isArray(role) ? role : [role]
  if (!allowed.includes(user.role)) throw new Error('FORBIDDEN')
  return user
}

export async function requireAdmin() {
  return requireRole('admin')
}

export async function requireSeller() {
  const user = await requireUser()
  if (user.role === 'admin') return user
  return requireRole('seller')
}
