import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

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
