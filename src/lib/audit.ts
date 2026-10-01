import { createAdminClient } from './supabase/admin'
import type { AuditActionType } from '@/types'

export async function logAudit(
  userId: string | null,
  action: AuditActionType,
  resourceType: string,
  resourceId: string | null = null,
  details: Record<string, unknown> | null = null,
) {
  try {
    const admin = createAdminClient()
    await admin.from('audit_logs').insert({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
    })
  } catch (err) {
    console.error('[AUDIT] Failed to write audit log:', err)
  }
}
