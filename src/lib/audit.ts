import { createAdminClient } from './supabase/admin'
import type { AuditActionType } from '@/types'
import { log, tryLog } from './logging'

/**
 * Audit-Log schreiben. GARANTIERT, dass es NIE wirft –
 * Audit-Logs dürfen den Hauptfluss niemals abbrechen.
 *
 * Schreibt via service_role (createAdminClient), sodass die neue
 * RLS-Policy (0018_SECURITY_RLS_HARDENING.sql → authenticated darf
 * KEINE audit_logs mehr inserten) umgangen wird.
 */
export function logAudit(
  userId: string | null,
  action: AuditActionType,
  resourceType: string,
  resourceId: string | null = null,
  details: Record<string, unknown> | null = null,
): Promise<void> {
  return tryLog<void>(
    'AUDIT',
    undefined as unknown as void,
    async (): Promise<void> => {
      const admin = createAdminClient()
      const { error } = await admin.from('audit_logs').insert({
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details,
      })
      if (error) {
        log.warn('AUDIT', 'Supabase-Fehler beim Schreiben des Audit-Logs', undefined, error)
      }
    },
    `Audit insert fehlgeschlagen: action=${action}`,
  )
}
