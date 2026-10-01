import { createClient } from './supabase/server'
import { createAdminClient } from './supabase/admin'
import type { DatabaseUser, UserRole } from '@/types'

const IS_DEV = process.env.NODE_ENV !== 'production'
const AUTH_BYPASS = IS_DEV && false
const BYPASS_USER: DatabaseUser & { auth_email: string } = {
  id: '11111111-1111-1111-1111-111111111111' as any,
  full_name: 'Ada Admin (Demo)',
  email: 'admin@test.local',
  role: 'admin' as UserRole,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  auth_email: 'admin@test.local',
} as any
const BYPASS_ADMIN = BYPASS_USER

export async function getCurrentUser(): Promise<(DatabaseUser & { auth_email: string | undefined }) | null> {
  try {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (AUTH_BYPASS && !authUser) {
      return BYPASS_USER
    }

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
    if (AUTH_BYPASS) return BYPASS_USER
    return null
  }
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (AUTH_BYPASS && !user) return BYPASS_USER
  if (!user) throw new Error('UNAUTHENTICATED')
  if (!user.is_active) throw new Error('USER_INACTIVE')
  return user
}

export async function requireRole(role: UserRole | UserRole[]) {
  const user = await requireUser()
  const allowed = Array.isArray(role) ? role : [role]
  if (AUTH_BYPASS) {
    if (allowed.includes('admin') && user.role !== 'admin') {
      return BYPASS_ADMIN
    }
    return user
  }
  if (!allowed.includes(user.role)) throw new Error('FORBIDDEN')
  return user
}

export async function requireAdmin() {
  return requireRole('admin')
}

export async function requireSeller() {
  const user = await requireUser()
  if (AUTH_BYPASS) {
    if (user.role === 'admin') return BYPASS_ADMIN
    return user
  }
  if (user.role === 'admin') return user
  return requireRole('seller')
}

export async function getUserWallet(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('token_wallets')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  return data
}

export function hasRole(user: { role: UserRole } | null, role: UserRole): boolean {
  if (!user) return false
  return user.role === role
}
