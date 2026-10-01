import { createAdminClient } from '../supabase/admin'
import type { Notification, NotificationType } from '@/types'
import { logAudit } from '../audit'

export async function getNotifications(
  userId: string,
  options: { onlyUnread?: boolean; limit?: number } = {},
): Promise<Notification[]> {
  const admin = createAdminClient()
  let query = admin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 50)
  if (options.onlyUnread) {
    query = query.is('read_at', null) as typeof query
  }
  const { data } = await query
  return (data ?? []) as Notification[]
}

export async function getUnreadCount(userId: string): Promise<number> {
  const admin = createAdminClient()
  const { count } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  return count ?? 0
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
}

export async function createNotification(input: {
  user_id: string
  type: NotificationType
  title: string
  body?: string | null
  link?: string | null
  data?: Record<string, unknown>
  created_by?: string
}): Promise<string | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('create_notification', {
      p_user_id: input.user_id,
      p_type: input.type,
      p_title: input.title,
      p_body: input.body ?? null,
      p_link: input.link ?? null,
      p_data: (input.data ?? {}) as any,
    })
    if (error || !data) return null
    return data as string
  } catch {
    return null
  }
}

export async function notifyLeadAssigned(userId: string, leadId: string, leadName: string): Promise<void> {
  await createNotification({
    user_id: userId,
    type: 'lead_assigned',
    title: 'Neuer Lead zugewiesen',
    body: `Dir wurde der Lead „${leadName}“ zugewiesen.`,
    link: `/leads/${leadId}`,
    data: { lead_id: leadId },
  })
}

export async function notifyLeadAvailable(userId: string, product?: string | null, leadCountAvailable = 1): Promise<void> {
  await createNotification({
    user_id: userId,
    type: 'lead_available',
    title: 'Leads wieder verfügbar',
    body: product
      ? `Es sind wieder ${leadCountAvailable} Lead(s) für ${product} verfügbar.`
      : `Es sind wieder ${leadCountAvailable} Lead(s) im Pool verfügbar.`,
    link: '/request-lead',
    data: { product, count: leadCountAvailable },
  })
}

export async function notifyTokenCredit(userId: string, amount: number, newBalance: number, reason?: string | null): Promise<void> {
  await createNotification({
    user_id: userId,
    type: 'token_credit',
    title: 'Tokens gutgeschrieben',
    body: `Dir wurden ${amount} Token(s) gutgeschrieben${reason ? ` (${reason})` : ''}. Neues Guthaben: ${newBalance}`,
    link: '/token-history',
    data: { amount, new_balance: newBalance, reason: reason ?? null },
  })
}

export async function notifyCallbackDue(userId: string, leadId: string, leadName: string, callbackAt: string): Promise<void> {
  await createNotification({
    user_id: userId,
    type: 'callback_due',
    title: 'Rückruf fällig',
    body: `Rückruf bei ${leadName} ist jetzt fällig.`,
    link: `/leads/${leadId}`,
    data: { lead_id: leadId, callback_at: callbackAt },
  })
}

export async function notifyTokenLow(userId: string, balance: number): Promise<void> {
  if (balance !== 5 && balance !== 2 && balance !== 1 && balance !== 0) return
  await createNotification({
    user_id: userId,
    type: 'token_low',
    title: balance === 0 ? 'Keine Tokens mehr' : 'Niedriges Token-Guthaben',
    body:
      balance === 0
        ? 'Dein Guthaben ist leer. Bitte kontaktiere einen Administrator, um weitere Tokens zu erhalten.'
        : `Du hast nur noch ${balance} Token(s) übrig.`,
    link: '/token-history',
    data: { balance },
  })
}
