import { createAdminClient } from '../supabase/admin'
import type { Lead, LeadStatus, UserRole, DatabaseUser, LeadWithDetails, ProductType, WaitlistEntry, TimeHeatmapCell } from '@/types'
import { logAudit } from '../audit'
import { getUserEmailMap } from '../user-emails'

export const TOKEN_COST_PER_LEAD = 1

export async function requestLead(userId: string, product?: ProductType | null): Promise<Lead> {
  const admin = createAdminClient()

  const { data: wallet } = await admin
    .from('token_wallets')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (!wallet) throw new Error('WALLET_NOT_FOUND')
  if (wallet.balance < TOKEN_COST_PER_LEAD) throw new Error('NOT_ENOUGH_TOKENS')

  const rpcArgs: any = { p_user_id: userId }
  if (product) rpcArgs.p_product = product

  const { data, error } = await admin.rpc('assign_next_lead_to_user', rpcArgs)
  if (error || !data) {
    if (error?.message?.includes('NO_LEAD') || !data) {
      throw new Error('NO_LEAD_AVAILABLE')
    }
    throw error
  }

  const leadId = data as string
  const { data: lead } = await admin
    .from('leads')
    .select('id, first_name, last_name, status, assigned_user_id, assigned_at')
    .eq('id', leadId)
    .limit(1)
    .maybeSingle()

  if (!lead) throw new Error('NO_LEAD_AVAILABLE')

  return lead as unknown as Lead
}

export async function getWaitlistEntry(userId: string): Promise<WaitlistEntry | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('lead_waitlist')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data ?? null) as WaitlistEntry | null
}

export async function addToWaitlist(userId: string, product?: ProductType | null): Promise<WaitlistEntry> {
  const admin = createAdminClient()
  const payload: any = { user_id: userId }
  if (product) payload.product = product

  const { data, error } = await admin
    .from('lead_waitlist')
    .insert(payload)
    .select()
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    if (error?.message?.includes('duplicate') || error?.code === '23505') {
      const existing = await getWaitlistEntry(userId)
      if (existing) return existing
    }
    throw error ?? new Error('WAITLIST_INSERT_FAILED')
  }

  return data as WaitlistEntry
}

export async function removeFromWaitlist(userId: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('lead_waitlist').delete().eq('user_id', userId)
}

export async function getLeadWithDetails(leadId: string, viewerId: string, viewerRole: UserRole): Promise<LeadWithDetails | null> {
  const admin = createAdminClient()
  let query = admin
    .from('leads')
    .select(`
      *,
      assigned_user:users!leads_assigned_user_id_fkey!left(id, full_name),
      campaign:campaigns(*),
      callbacks(*),
      contact_attempts(*),
      status_history:lead_status_history(*, user:users!lead_status_history_user_id_fkey!left(id, full_name)),
      lead_tags!left(*, tags!left(*)),
      lead_documents!left(*)
    `)
    .eq('id', leadId)
    .eq('is_deleted', false)
    .limit(1)

  if (viewerRole !== 'admin') {
    query = query.eq('assigned_user_id', viewerId) as typeof query
  }

  let data: any = null
  try {
    const res = await query.maybeSingle()
    data = res.data
  } catch {
  }

  if (!data) {
    const fallbackQuery = admin
      .from('leads')
      .select(`
        *,
        campaign:campaigns(*),
        callbacks(*),
        contact_attempts(*),
        status_history:lead_status_history(*),
        lead_tags!left(*, tags!left(*)),
        lead_documents!left(*)
      `)
      .eq('id', leadId)
      .eq('is_deleted', false)
      .limit(1)
    if (viewerRole !== 'admin') {
      const fallbackQueryTyped = fallbackQuery.eq('assigned_user_id', viewerId)
      const fr = await fallbackQueryTyped.maybeSingle()
      data = fr.data
    } else {
      const fr = await fallbackQuery.maybeSingle()
      data = fr.data
    }
    if (data) {
      if (data.assigned_user_id) {
        const { data: usr } = await admin
          .from('users')
          .select('id, full_name')
          .eq('id', data.assigned_user_id)
          .limit(1)
          .maybeSingle()
        data.assigned_user = usr ?? null
      } else {
        data.assigned_user = null
      }
      if (Array.isArray(data.status_history)) {
        const histUserIds = [...new Set(data.status_history.map((h: any) => h.user_id).filter(Boolean))]
        if (histUserIds.length > 0) {
          const { data: histUsers } = await admin.from('users').select('id, full_name').in('id', histUserIds)
          const histUserMap = new Map((histUsers ?? []).map((u: any) => [u.id, u]))
          for (const h of data.status_history) {
            h.user = histUserMap.get(h.user_id) ?? null
          }
        }
      }
    }
  }

  if (data) {
    const userIds: string[] = []
    if (data.assigned_user?.id) userIds.push(data.assigned_user.id)
    for (const h of data.status_history ?? []) {
      if (h.user?.id) userIds.push(h.user.id)
    }
    if (userIds.length > 0) {
      const emailMap = await getUserEmailMap(userIds)
      if (data.assigned_user?.id) {
        data.assigned_user.email = emailMap.get(data.assigned_user.id) ?? ''
      }
      for (const h of data.status_history ?? []) {
        if (h.user?.id) {
          h.user.email = emailMap.get(h.user.id) ?? ''
        }
      }
    }
    data.tags = (data.lead_tags ?? [])
      .filter((lt: any) => lt?.tags)
      .map((lt: any) => lt.tags)
    data.documents = data.lead_documents ?? []
    delete data.lead_tags
    delete data.lead_documents
  }
  return (data as LeadWithDetails) ?? null
}

export async function updateLeadStatus(
  leadId: string,
  newStatus: LeadStatus,
  userId: string,
  userRole: UserRole,
) {
  const admin = createAdminClient()

  const { data: lead } = await admin
    .from('leads')
    .select('id, status, assigned_user_id')
    .eq('id', leadId)
    .limit(1)
    .maybeSingle()

  if (!lead) throw new Error('LEAD_NOT_FOUND')
  if (userRole !== 'admin' && lead.assigned_user_id !== userId) {
    throw new Error('FORBIDDEN')
  }

  if (lead.status === newStatus) return

  await admin
    .from('leads')
    .update({ status: newStatus, updated_by: userId })
    .eq('id', leadId)

  await logAudit(userId, 'STATUS_CHANGED', 'lead', leadId, {
    old_status: lead.status,
    new_status: newStatus,
  })
}

export async function updateLeadNotes(
  leadId: string,
  notes: string,
  userId: string,
  userRole: UserRole,
) {
  const admin = createAdminClient()
  const { data: lead } = await admin
    .from('leads')
    .select('id, assigned_user_id')
    .eq('id', leadId)
    .limit(1)
    .maybeSingle()
  if (!lead) throw new Error('LEAD_NOT_FOUND')
  if (userRole !== 'admin' && lead.assigned_user_id !== userId) throw new Error('FORBIDDEN')

  await admin.from('leads').update({ notes, updated_by: userId }).eq('id', leadId)
}

export async function getMyLeads(
  userId: string,
  params: {
    statuses?: LeadStatus[]
    search?: string
    sortBy?: string
    sortDir?: 'asc' | 'desc'
    from?: string
    to?: string
    page?: number
    pageSize?: number
  } = {},
) {
  const admin = createAdminClient()
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 25
  let query = admin
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('assigned_user_id', userId)
    .eq('is_deleted', false)

  if (params.statuses && params.statuses.length > 0) {
    query = query.in('status', params.statuses) as typeof query
  }
  if (params.search) {
    const s = `%${params.search}%`
    query = query.or(
      `first_name.ilike.${s},last_name.ilike.${s},phone.ilike.${s},email.ilike.${s}`,
    ) as typeof query
  }
  if (params.from) {
    query = query.gte('assigned_at', new Date(params.from).toISOString()) as typeof query
  }
  if (params.to) {
    query = query.lte('assigned_at', new Date(params.to + 'T23:59:59').toISOString()) as typeof query
  }
  const sortBy = params.sortBy ?? 'assigned_at'
  const sortDir = params.sortDir ?? 'desc'
  query = query.order(sortBy, { ascending: sortDir === 'asc', nullsFirst: false }) as typeof query

  const fromIdx = (page - 1) * pageSize
  const { data, count, error } = await query.range(fromIdx, fromIdx + pageSize - 1)
  if (error) throw error
  return { data: data as Lead[], count: count ?? 0, page, pageSize }
}

export async function addContactAttempt(input: {
  lead_id: string
  user_id: string
  attempt_date: string
  result: string
  notes?: string | null
  call_duration_seconds?: number | null
}) {
  const admin = createAdminClient()
  const insertBase: Record<string, unknown> = {
    lead_id: input.lead_id,
    user_id: input.user_id,
    attempt_date: input.attempt_date,
    result: input.result,
    notes: input.notes ?? null,
  }
  let insert: Record<string, unknown> = { ...insertBase }
  let durationValid = false
  if (input.call_duration_seconds !== undefined && input.call_duration_seconds !== null) {
    const v = Math.max(0, Number(input.call_duration_seconds) || 0)
    if (v > 0) {
      insert.call_duration_seconds = v
      durationValid = true
    }
  }
  let { error } = await admin.from('contact_attempts').insert(insert)
  if (error && durationValid && /call_duration_seconds/.test(error.message ?? '')) {
    ;({ error } = await admin.from('contact_attempts').insert(insertBase))
  }
  if (error) throw error
  await logAudit(input.user_id, 'CONTACT_ATTEMPT', 'lead', input.lead_id, { result: input.result })

  const { data: lead } = await admin
    .from('leads')
    .select('id, status, assigned_user_id')
    .eq('id', input.lead_id)
    .limit(1)
    .maybeSingle()
  if (lead && (lead.status === 'assigned' || lead.status === 'new')) {
    const upd: any = { status: 'contacted' as LeadStatus, updated_by: input.user_id }
    await admin.from('leads').update(upd).eq('id', input.lead_id)
    await logAudit(input.user_id, 'STATUS_CHANGED', 'lead', input.lead_id, {
      old_status: lead.status,
      new_status: 'contacted',
      via: 'addContactAttempt',
    })
  }
}

export async function createCallback(input: {
  lead_id: string
  user_id: string
  callback_at: string
  notes?: string | null
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('callbacks')
    .insert({
      lead_id: input.lead_id,
      user_id: input.user_id,
      callback_at: input.callback_at,
      notes: input.notes ?? null,
      status: 'offen',
    })
    .select('id')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  await logAudit(input.user_id, 'CALLBACK_CREATED', 'callback', data?.id ?? null, { lead_id: input.lead_id, callback_at: input.callback_at })

  const { data: lead } = await admin
    .from('leads')
    .select('id, status')
    .eq('id', input.lead_id)
    .limit(1)
    .maybeSingle()
  if (lead && (lead.status === 'new' || lead.status === 'assigned' || lead.status === 'contacted')) {
    const oldStatus = lead.status
    const upd: any = { status: 'callback' as LeadStatus, updated_by: input.user_id }
    await admin.from('leads').update(upd).eq('id', input.lead_id)
    await logAudit(input.user_id, 'STATUS_CHANGED', 'lead', input.lead_id, {
      old_status: oldStatus,
      new_status: 'callback',
      via: 'createCallback',
    })
  }
  return data
}

export async function updateCallbackStatus(callbackId: string, status: 'offen' | 'erledigt' | 'storniert', userId: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('callbacks')
    .update({ status })
    .eq('id', callbackId)
    .eq('user_id', userId)
  if (error) throw error
  await logAudit(userId, 'CALLBACK_UPDATED', 'callback', callbackId, { status })
}

export async function getMyCallbacks(userId: string, onlyOpen = false) {
  const admin = createAdminClient()
  let query = admin
    .from('callbacks')
    .select(`
      *,
      lead:leads(id, first_name, last_name, phone, status)
    `)
    .eq('user_id', userId)
  if (onlyOpen) {
    query = query.eq('status', 'offen') as typeof query
  }
  const { data, error } = await query.order('callback_at', { ascending: true })
  if (error) throw error
  return data
}

export async function getSellerDashboardStats(userId: string) {
  const admin = createAdminClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const yesterdayISO = yesterdayStart.toISOString()

  const [
    walletRes,
    myLeadsCountRes,
    todayLeadsRes,
    closedRes,
    lostRes,
    openCallbacksRes,
    overdueCallbacksRes,
    yesterdayClosed,
    yesterdayLost,
    yesterdayLeadsToday,
  ] = await Promise.all([
    admin.from('token_wallets').select('balance').eq('user_id', userId).maybeSingle(),
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_user_id', userId).eq('is_deleted', false),
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_user_id', userId).gte('updated_at', todayISO).eq('is_deleted', false),
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_user_id', userId).eq('status', 'closed').eq('is_deleted', false),
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_user_id', userId).in('status', ['no_interest', 'wrong_data', 'canceled']).eq('is_deleted', false),
    admin.from('callbacks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'offen'),
    admin.from('callbacks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'offen').lt('callback_at', new Date().toISOString()),
    admin.from('lead_status_history').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('new_status', 'closed').gte('created_at', yesterdayISO).lt('created_at', todayISO),
    admin.from('lead_status_history').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('new_status', ['no_interest', 'wrong_data', 'canceled']).gte('created_at', yesterdayISO).lt('created_at', todayISO),
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_user_id', userId).gte('updated_at', yesterdayISO).lt('updated_at', todayISO).eq('is_deleted', false),
  ])

  const abschlüsse = closedRes.count ?? 0
  const verloren = lostRes.count ?? 0
  const abschlussQuote = (abschlüsse + verloren) > 0 ? abschlüsse / (abschlüsse + verloren) : 0

  const yestAbschlüsse = yesterdayClosed.count ?? 0
  const yestVerloren = yesterdayLost.count ?? 0
  const yestQuote = (yestAbschlüsse + yestVerloren) > 0 ? yestAbschlüsse / (yestAbschlüsse + yestVerloren) : 0

  const trySumDuration = async (gteIso: string, ltIso?: string): Promise<number> => {
    try {
      const q = admin
        .from('contact_attempts')
        .select('call_duration_seconds')
        .eq('user_id', userId)
        .gte('attempt_date', gteIso)
        .not('call_duration_seconds', 'is', null)
      const finalQ = ltIso ? q.lt('attempt_date', ltIso) : q
      const { data, error } = await finalQ
      if (error || !data) return 0
      return data.reduce((s: number, r: any) => s + (Number(r.call_duration_seconds) || 0), 0)
    } catch {
      return 0
    }
  }

  const [todaySec, yestSec] = await Promise.all([
    trySumDuration(todayISO),
    trySumDuration(yesterdayISO, todayISO),
  ])

  const pctDiff = (cur: number, base: number): number | null => {
    if (base === 0 && cur === 0) return null
    if (base === 0) return 100
    return ((cur - base) / base) * 100
  }

  return {
    token_balance: (walletRes.data as any)?.balance ?? 0,
    leads_total: myLeadsCountRes.count ?? 0,
    leads_today: todayLeadsRes.count ?? 0,
    abschlüsse,
    verloren,
    abschluss_quote: abschlussQuote,
    callbacks_offen: openCallbacksRes.count ?? 0,
    callbacks_ueberfaellig: overdueCallbacksRes.count ?? 0,
    talk_time: {
      today_seconds: todaySec,
      yesterday_seconds: yestSec,
      delta_vs_yesterday_pct: pctDiff(todaySec, yestSec),
    },
    trends: {
      leads_today_vs_yesterday_pct: pctDiff(todayLeadsRes.count ?? 0, yesterdayLeadsToday.count ?? 0),
      abschlussquote_vs_yesterday_pct: pctDiff(abschlussQuote * 100, yestQuote * 100),
    },
  }
}

export async function getRecentActivity(userId: string, limit = 10) {
  const admin = createAdminClient()
  let attempts: any[] = []
  try {
    const res = await admin
      .from('contact_attempts')
      .select(`id, result, attempt_date, notes, call_duration_seconds, lead:leads(id, first_name, last_name)`)
      .eq('user_id', userId)
      .order('attempt_date', { ascending: false })
      .limit(limit)
    attempts = (res.data ?? []) as any[]
    if (res.error && /call_duration_seconds/.test(res.error.message ?? '')) {
      const fall = await admin
        .from('contact_attempts')
        .select(`id, result, attempt_date, notes, lead:leads(id, first_name, last_name)`)
        .eq('user_id', userId)
        .order('attempt_date', { ascending: false })
        .limit(limit)
      attempts = (fall.data ?? []) as any[]
    }
  } catch {
    try {
      const fall = await admin
        .from('contact_attempts')
        .select(`id, result, attempt_date, notes, lead:leads(id, first_name, last_name)`)
        .eq('user_id', userId)
        .order('attempt_date', { ascending: false })
        .limit(limit)
      attempts = (fall.data ?? []) as any[]
    } catch {
      attempts = []
    }
  }

  const { data: statuses } = await admin
    .from('lead_status_history')
    .select(`id, new_status, created_at, lead:leads(id, first_name, last_name)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return { attempts, statuses: statuses ?? [] }
}

export async function getUpcomingCallbacks(userId: string, limit = 5) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('callbacks')
    .select(`*, lead:leads(id, first_name, last_name, phone, status)`)
    .eq('user_id', userId)
    .eq('status', 'offen')
    .order('callback_at', { ascending: true })
    .limit(limit)
  return data ?? []
}

export interface WorklistItem {
  kind: 'callback_overdue' | 'callback_soon' | 'new_lead' | 'inactive_lead'
  id: string
  title: string
  lead_id: string
  phone: string | null
  reason: string
  sort_key: number
  callback_at?: string | null
  assigned_at?: string | null
}

export async function getWorklist(userId: string, limit = 10): Promise<WorklistItem[]> {
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
  const staleAfter = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()

  const [overdueCbs, soonCbs, newLeads, staleLeads] = await Promise.all([
    admin
      .from('callbacks')
      .select('id, lead_id, callback_at, lead:leads(id, first_name, last_name, phone, created_at)')
      .eq('user_id', userId)
      .eq('status', 'offen')
      .lt('callback_at', nowIso)
      .order('callback_at', { ascending: true })
      .limit(Math.ceil(limit / 2))
      .then((r) => r.data ?? []),
    admin
      .from('callbacks')
      .select('id, lead_id, callback_at, lead:leads(id, first_name, last_name, phone, created_at)')
      .eq('user_id', userId)
      .eq('status', 'offen')
      .gte('callback_at', nowIso)
      .lte('callback_at', inOneHour)
      .order('callback_at', { ascending: true })
      .limit(Math.ceil(limit / 2))
      .then((r) => r.data ?? []),
    admin
      .from('leads')
      .select('id, first_name, last_name, phone, created_at')
      .eq('assigned_user_id', userId)
      .eq('status', 'assigned')
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(Math.ceil(limit / 2))
      .then((r) => r.data ?? []),
    admin
      .from('leads')
      .select('id, first_name, last_name, phone, updated_at')
      .eq('assigned_user_id', userId)
      .eq('status', 'contacted')
      .eq('is_deleted', false)
      .lte('updated_at', staleAfter)
      .order('updated_at', { ascending: true })
      .limit(Math.ceil(limit / 3))
      .then((r) => r.data ?? []),
  ])

  const out: WorklistItem[] = []

  for (const cb of overdueCbs as any[]) {
    const lead = cb.lead as any
    out.push({
      kind: 'callback_overdue',
      id: `cb-${cb.id}`,
      lead_id: cb.lead_id,
      title: `${lead.first_name} ${lead.last_name}`,
      phone: lead.phone,
      reason: 'Überfälliger Rückruf',
      callback_at: cb.callback_at,
      sort_key: new Date(cb.callback_at).getTime(),
    })
  }

  for (const lead of newLeads as any[]) {
    out.push({
      kind: 'new_lead',
      id: `nl-${lead.id}`,
      lead_id: lead.id,
      title: `${lead.first_name} ${lead.last_name}`,
      phone: lead.phone,
      reason: 'Neu zugewiesen',
      assigned_at: lead.created_at,
      sort_key: new Date(lead.created_at).getTime() + 86_400_000 * 3, // neue Eintrag soll nach kurzfristigen Rückrufen aber vor „Knots
    })
  }

  for (const cb of soonCbs as any[]) {
    const lead = cb.lead as any
    out.push({
      kind: 'callback_soon',
      id: `cbs-${cb.id}`,
      lead_id: cb.lead_id,
      title: `${lead.first_name} ${lead.last_name}`,
      phone: lead.phone,
      reason: 'Rückruf in Kürze',
      callback_at: cb.callback_at,
      sort_key: new Date(cb.callback_at).getTime() + 86_400_000 * 5,
    })
  }

  for (const lead of staleLeads as any[]) {
    out.push({
      kind: 'inactive_lead',
      id: `stale-${lead.id}`,
      lead_id: lead.id,
      title: `${lead.first_name} ${lead.last_name}`,
      phone: lead.phone,
      reason: 'Längere Zeit inaktiv',
      assigned_at: lead.updated_at,
      sort_key: new Date(lead.updated_at).getTime() + 86_400_000 * 10,
    })
  }

  out.sort((a, b) => a.sort_key - b.sort_key)
  return out.slice(0, limit)
}

export async function getContactTimeHeatmap(userId: string, days = 56): Promise<TimeHeatmapCell[]> {
  const admin = createAdminClient()
  try {
    const rpcRes: any = await admin.rpc('get_contact_time_heatmap', { p_user_id: userId, p_days: days })
    if (!rpcRes?.error && Array.isArray(rpcRes?.data) && rpcRes.data.length > 0) {
      return rpcRes.data as TimeHeatmapCell[]
    }
  } catch {}
  return [] as TimeHeatmapCell[]
}

export async function getAvailableLeadCount(product?: ProductType | null): Promise<number> {
  const admin = createAdminClient()
  let query = admin
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .eq('is_on_hold', false)
    .is('assigned_user_id', null)
    .not('status', 'in', '("canceled","wrong_data","no_interest","closed")')

  if (product && product !== 'beides') {
    query = query.eq('product', product) as typeof query
  }

  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export async function getAvailableLeadCountBreakdown(): Promise<{
  total: number
  strom: number
  gas: number
  beides: number
}> {
  const admin = createAdminClient()
  const base = admin
    .from('leads')
    .select('id, product', { count: 'exact' })
    .eq('is_deleted', false)
    .eq('is_on_hold', false)
    .is('assigned_user_id', null)
    .not('status', 'in', '("canceled","wrong_data","no_interest","closed")')

  const { data, error } = await base
  if (error) throw error
  const rows = (data ?? []) as Array<{ product: string | null }>
  const strom = rows.filter((r) => r.product === 'strom').length
  const gas = rows.filter((r) => r.product === 'gas').length
  const beides = rows.filter((r) => r.product === 'beides').length
  return {
    total: rows.length,
    strom,
    gas,
    beides,
  }
}
