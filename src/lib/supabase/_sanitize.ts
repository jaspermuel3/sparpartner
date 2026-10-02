export function stripBomAndWs(v: string | null | undefined): string {
  if (v === undefined || v === null) return ''
  let s = String(v)
  if (s.length === 0) return s
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
  return s.replace(/[\u200b-\u200f\ufeff\ufffe]/g, '').trim()
}

export function getSupabaseUrl(): string {
  return stripBomAndWs(process.env.NEXT_PUBLIC_SUPABASE_URL)
}

export function getSupabaseAnonKey(): string {
  return stripBomAndWs(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function getSupabaseServiceRoleKey(): string {
  return stripBomAndWs(process.env.SUPABASE_SERVICE_ROLE_KEY)
}
