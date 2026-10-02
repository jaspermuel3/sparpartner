'use client'

import { createBrowserClient } from '@supabase/ssr'
import { stripBomAndWs } from './_sanitize'

export function createClient() {
  return createBrowserClient(
    stripBomAndWs(process.env.NEXT_PUBLIC_SUPABASE_URL),
    stripBomAndWs(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  )
}
