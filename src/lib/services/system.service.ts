import { createAdminClient } from '../supabase/admin'
import { logAudit } from '../audit'
import { log, tryLog } from '../logging'

export type SystemSettingValue = string | number | boolean | null | Record<string, unknown>

export interface SystemSettings {
  maintenance_mode: { enabled: boolean; message: string }
  landing_api_enabled: { enabled: boolean }
}

function parseSetting<T = unknown>(row: any, fallback: T): T {
  if (!row || !row.value) return fallback
  try {
    return (row.value as unknown) as T
  } catch {
    return fallback
  }
}

export async function getAllSettings(): Promise<Partial<Record<string, unknown>>> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('system_settings').select('key, value')
  if (error) {
    log.warn('SYSTEM', 'getAllSettings query failed', undefined, error)
    return {}
  }
  const out: Record<string, unknown> = {}
  for (const row of data ?? []) {
    out[row.key] = row.value
  }
  return out
}

export async function getSetting<T = unknown>(key: string, fallback: T): Promise<T> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (error || !data) return fallback
  return parseSetting<T>(data, fallback)
}

export async function setSetting(key: string, value: unknown, updatedBy?: string): Promise<void> {
  const admin = createAdminClient()
  const payload: any = {
    key,
    value: value as any,
    updated_by: updatedBy ?? null,
  }
  const { error } = await admin
    .from('system_settings')
    .upsert(payload, { onConflict: 'key' })
  if (error) throw error
  if (updatedBy) {
    await tryLog(
      'AUDIT',
      undefined,
      () => logAudit(updatedBy, 'ADMIN_CHANGE', 'system_settings', undefined, { key, value }),
      'logAudit setSetting',
    )
  }
}

export async function getMaintenanceMode(): Promise<{
  enabled: boolean
  message: string
}> {
  const v = await getSetting<any>('maintenance_mode', null)
  if (!v || typeof v !== 'object') {
    return { enabled: false, message: 'Wartungsarbeiten. Bitte versuche es später erneut.' }
  }
  return {
    enabled: Boolean(v.enabled),
    message: typeof v.message === 'string' ? v.message : 'Wartungsarbeiten. Bitte versuche es später erneut.',
  }
}

export async function setMaintenanceMode(
  enabled: boolean,
  message: string | undefined,
  updatedBy: string,
): Promise<void> {
  const current = await getMaintenanceMode()
  const value: any = {
    enabled,
    message: message ?? current.message,
  }
  await setSetting('maintenance_mode', value, updatedBy)
}

export async function getLandingApiEnabled(): Promise<boolean> {
  const v = await getSetting<any>('landing_api_enabled', null)
  if (!v || typeof v !== 'object') return true
  return Boolean(v.enabled)
}

export async function setLandingApiEnabled(enabled: boolean, updatedBy: string): Promise<void> {
  await setSetting('landing_api_enabled', { enabled }, updatedBy)
}

export interface HealthStatus {
  supabase_db: { ok: boolean; latency_ms: number; error?: string }
  pg_cron: { ok: boolean; error?: string }
  env_vars: {
    supabase_url: boolean
    supabase_anon_key: boolean
    service_role_key: boolean
    landing_api_key: boolean
  }
}

export async function runHealthChecks(): Promise<HealthStatus> {
  const admin = createAdminClient()
  const start = performance.now()
  let dbOk = false
  let dbErr: string | undefined
  try {
    const { error } = await admin.from('users').select('id', { count: 'exact', head: true }).limit(1)
    if (error) throw error
    dbOk = true
  } catch (e: any) {
    dbErr = e?.message ?? String(e)
  }
  const dbLatency = Math.round(performance.now() - start)

  let pgCronOk = false
  let pgCronErr: string | undefined
  try {
    const { error: extErr } = await admin.rpc('cron_version', {} as any)
    if (!extErr) {
      pgCronOk = true
    } else {
      pgCronErr = (extErr as any)?.message ?? 'pg_cron Extension nicht aktiviert (bitte manuell im Supabase Dashboard aktivieren)'
    }
  } catch (e: any) {
    pgCronErr = e?.message ?? String(e)
  }

  const env_vars = {
    supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabase_anon_key: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    landing_api_key: Boolean(process.env.LANDING_API_KEY),
  }

  return {
    supabase_db: { ok: dbOk, latency_ms: dbLatency, error: dbErr },
    pg_cron: { ok: pgCronOk, error: pgCronErr },
    env_vars,
  }
}
