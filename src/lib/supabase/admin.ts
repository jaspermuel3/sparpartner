import { createClient } from '@supabase/supabase-js'
import { getSupabaseUrl, getSupabaseServiceRoleKey } from './_sanitize'

export function createAdminClient() {
  const url = getSupabaseUrl()
  const key = getSupabaseServiceRoleKey()

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL ist nicht gesetzt.')
  }
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt. Bitte füge ihn in Vercel unter ' +
      'Project Settings → Environment Variables hinzu (Scope: Production + Preview + Development).',
    )
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
