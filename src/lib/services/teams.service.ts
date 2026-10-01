import { createAdminClient } from '@/lib/supabase/admin'

export async function getAllTeams() {
  const admin = createAdminClient()
  const { data } = await admin.from('teams').select('*').order('name')
  return (data ?? []) as any[]
}

export async function createTeam(name: string, color: string | null, byUserId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('teams')
    .insert({ name, color, created_by: byUserId })
    .select()
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}
