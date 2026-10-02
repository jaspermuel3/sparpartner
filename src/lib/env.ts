/* ============================================================
   Env-Validierung
   ------------------------------------------------------------
   Einfache, Zero-Dependency Validierung aller erforderlichen
   Env-Variablen. Läuft bei der ersten Benutzung und schlägt
   mit klarer Fehlermeldung fehl, falls etwas fehlt.

   Optionales Upgrade: Zod + `src/lib/env.zod.ts`
   (Package "zod" ist in package.json als empfohlene
    Dependency vermerkt und kann manuell installiert werden.)
   ============================================================ */

export type PublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  NEXT_PUBLIC_DISABLE_NOTIFICATIONS?: string
}

export type ServerEnv = PublicEnv & {
  SUPABASE_SERVICE_ROLE_KEY: string
  LANDING_API_KEY: string
  NODE_ENV: 'development' | 'production' | 'test'
}

function mustBeNonEmpty(name: string, value: string | undefined, minLength = 1): string {
  const v = (value ?? '').trim()
  if (v.length < minLength) {
    throw new Error(
      `[ENV] Pflicht-Variable "${name}" fehlt oder ist zu kurz (min. ${minLength} Zeichen). ` +
        `Bitte in .env.local / Vercel Project Settings konfigurieren.`,
    )
  }
  return v
}

function mustBeUrl(name: string, value: string | undefined): string {
  const raw = mustBeNonEmpty(name, value, 8)
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && process.env.NODE_ENV !== 'development') {
      throw new Error(`Nur https:// URLs sind außerhalb der Entwicklung erlaubt (${name}).`)
    }
    return raw
  } catch (e) {
    throw new Error(`[ENV] Pflicht-Variable "${name}" ist keine gültige URL: ${(e as Error).message}`)
  }
}

let _env: ServerEnv | null = null

export function getEnv(): ServerEnv {
  if (_env) return _env
  const raw = process.env

  const nodeEnv = (raw.NODE_ENV ?? 'development') as ServerEnv['NODE_ENV']
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error(`[ENV] NODE_ENV hat ungültigen Wert: ${nodeEnv}`)
  }

  const parsed: ServerEnv = {
    NODE_ENV: nodeEnv,
    NEXT_PUBLIC_SUPABASE_URL: mustBeUrl('NEXT_PUBLIC_SUPABASE_URL', raw.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: mustBeNonEmpty('NEXT_PUBLIC_SUPABASE_ANON_KEY', raw.NEXT_PUBLIC_SUPABASE_ANON_KEY, 20),
    SUPABASE_SERVICE_ROLE_KEY: mustBeNonEmpty('SUPABASE_SERVICE_ROLE_KEY', raw.SUPABASE_SERVICE_ROLE_KEY, 20),
    LANDING_API_KEY: mustBeNonEmpty('LANDING_API_KEY', raw.LANDING_API_KEY, 32),
    NEXT_PUBLIC_DISABLE_NOTIFICATIONS: raw.NEXT_PUBLIC_DISABLE_NOTIFICATIONS,
  }
  _env = parsed
  return parsed
}

/* ---------- Short-Helpers (verwendbar als Drop-In-Ersatz für process.env.*) ---------- */

export const getSupabaseUrl = (): string => getEnv().NEXT_PUBLIC_SUPABASE_URL
export const getSupabaseAnonKey = (): string => getEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY
export const getSupabaseServiceRoleKey = (): string => getEnv().SUPABASE_SERVICE_ROLE_KEY
export const getLandingApiKey = (): string => getEnv().LANDING_API_KEY
export const getNodeEnv = (): ServerEnv['NODE_ENV'] => getEnv().NODE_ENV
export const isProd = (): boolean => getNodeEnv() === 'production'
export const isDev = (): boolean => getNodeEnv() === 'development'
