import { createAdminClient } from '../supabase/admin'
import { logAudit } from '../audit'
import type { DatabaseUser, Lead, LeadStatus, ProductType } from '@/types'
import { getUserEmailMap, withEmail } from '../user-emails'

export async function createSeller(
  input: { email: string; password?: string; full_name: string; initial_balance?: number; role?: 'admin' | 'seller' },
  createdBy: string,
): Promise<{ userId: string }> {
  const admin = createAdminClient()

  let authData: { user: any }
  let authErr: any = null

  if (input.password) {
    const res = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    })
    authData = res.data as any
    authErr = res.error
    if (!authErr) {
      const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(input.email)
      if (inviteErr) authErr = inviteErr
    }
  } else {
    const res = await admin.auth.admin.inviteUserByEmail(input.email, {
      data: {
        full_name: input.full_name,
      },
    })
    authData = res.data as any
    authErr = res.error
  }

  if (authErr) throw authErr
  if (!authData?.user) throw new Error('AUTH_CREATE_FAILED')

  const role = input.role ?? 'seller'

  const { error: profileErr } = await admin.from('users').insert({
    id: authData.user.id,
    full_name: input.full_name,
    role: role,
    is_active: true,
  })
  if (profileErr) throw profileErr

  if (input.initial_balance && input.initial_balance > 0) {
    await admin
      .from('token_wallets')
      .update({ balance: input.initial_balance })
      .eq('user_id', authData.user.id)

    await admin.from('token_transactions').insert({
      wallet_id: (await admin.from('token_wallets').select('id').eq('user_id', authData.user.id).maybeSingle()).data?.id,
      user_id: authData.user.id,
      amount: input.initial_balance,
      type: 'aufladung',
      reason: 'Startguthaben bei Erstellung',
      created_by: createdBy,
    })
  }

  await logAudit(createdBy, 'SELLER_CREATED', 'user', authData.user.id, {
    email: input.email,
    full_name: input.full_name,
    role: role,
  })
  return { userId: authData.user.id }
}

export async function updateSeller(userId: string, patch: Partial<Pick<DatabaseUser, 'full_name' | 'is_active' | 'role'>>, updatedBy: string) {
  const admin = createAdminClient()
  const { data: old } = await admin.from('users').select('*').eq('id', userId).maybeSingle()
  if (!old) throw new Error('USER_NOT_FOUND')

  const { error } = await admin.from('users').update(patch).eq('id', userId)
  if (error) throw error

  if (typeof patch.is_active === 'boolean' && patch.is_active !== (old as DatabaseUser).is_active) {
    await logAudit(updatedBy, patch.is_active ? 'SELLER_ACTIVATED' : 'SELLER_DEACTIVATED', 'user', userId)
  } else {
    await logAudit(updatedBy, 'SELLER_UPDATED', 'user', userId, { patch })
  }
}

export async function resetSellerPassword(userId: string, newPassword: string) {
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) throw error
}

export async function getAllSellers() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select(`
      *,
      wallet:token_wallets(balance)
    `)
    .order('full_name', { nullsFirst: false })
  const rows = (data ?? []) as any[]
  if (!rows.length) return rows
  const emailMap = await getUserEmailMap(rows.map((r: any) => r.id))
  return rows.map((r) => withEmail(r, emailMap))
}

export async function getAdminDashboardStats() {
  const admin = createAdminClient()

  try {
    const rpcRes: any = await admin.rpc('get_admin_dashboard_stats')
    const rpcRow = rpcRes?.data
    const rpcErr = rpcRes?.error
    if (!rpcErr && rpcRow) {
      const row = Array.isArray(rpcRow) ? rpcRow[0] : rpcRow
      if (row) {
        const closed = Number(row.closed_leads ?? 0)
        const lost = Number(row.lost_leads ?? 0)
        const quote = (closed + lost) > 0 ? closed / (closed + lost) : 0
        return {
          new_leads_today: Number(row.new_leads_today ?? 0),
          available_leads: Number(row.available_leads ?? 0),
          assigned_leads: Number(row.assigned_leads ?? 0),
          closed_leads: closed,
          lost_leads: lost,
          abschluss_quote: quote,
          active_sellers: Number(row.active_sellers ?? 0),
          tokens_debit: Number(row.tokens_debit ?? 0),
        }
      }
    }
  } catch {
    // Fallback unten
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const [
    newLeadsToday,
    availableLeads,
    assignedLeads,
    closedLeads,
    activeSellers,
  ] = await Promise.all([
    admin.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', todayISO).eq('is_deleted', false),
    admin.from('leads').select('id', { count: 'exact', head: true }).is('assigned_user_id', null).eq('is_deleted', false),
    admin.from('leads').select('id', { count: 'exact', head: true }).not('assigned_user_id', 'is', null).eq('is_deleted', false),
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'closed').eq('is_deleted', false),
    admin.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('role', 'seller'),
  ])

  const { data: debitRows } = await admin.from('token_transactions').select('amount').lt('amount', 0)
  const debitSum = (debitRows ?? []).reduce((acc, t: any) => acc + (t.amount ?? 0), 0)
  const closed = closedLeads.count ?? 0

  const { count: lost } = await admin
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .in('status', ['no_interest', 'wrong_data', 'canceled'])
    .eq('is_deleted', false)
  const lostN = lost ?? 0
  const quote = (closed + lostN) > 0 ? closed / (closed + lostN) : 0

  return {
    new_leads_today: newLeadsToday.count ?? 0,
    available_leads: availableLeads.count ?? 0,
    assigned_leads: assignedLeads.count ?? 0,
    closed_leads: closed,
    lost_leads: lostN,
    abschluss_quote: quote,
    active_sellers: activeSellers.count ?? 0,
    tokens_debit: Math.abs(debitSum),
  }
}

export async function getLeadStatusDistribution() {
  const admin = createAdminClient()
  try {
    const rpcRes: any = await admin.rpc('get_lead_status_distribution')
    if (!rpcRes?.error && Array.isArray(rpcRes?.data) && rpcRes.data.length > 0) {
      const map: Record<string, number> = {}
      for (const row of rpcRes.data as any[]) {
        map[row.status as LeadStatus] = Number(row.count ?? 0)
      }
      return map
    }
  } catch {
    // Fallback unten
  }
  const { data } = await admin.from('leads').select('status').eq('is_deleted', false)
  const map: Record<string, number> = {}
  for (const row of data ?? []) {
    const s = (row as any).status as LeadStatus
    map[s] = (map[s] ?? 0) + 1
  }
  return map
}

export async function getLeadsPerDay(days = 7) {
  const admin = createAdminClient()
  try {
    const rpcRes: any = await admin.rpc('get_leads_per_day', { p_days: days })
    if (!rpcRes?.error && Array.isArray(rpcRes?.data) && rpcRes.data.length > 0) {
      return rpcRes.data.map((r: any) => ({
        date: r.date_label,
        count: Number(r.new_count ?? 0),
        closed: Number(r.closed_count ?? 0),
      }))
    }
  } catch {
    // Fallback unten
  }

  const from = new Date()
  from.setDate(from.getDate() - days + 1)
  from.setHours(0, 0, 0, 0)
  const fromISO = from.toISOString()
  const labels: string[] = []
  const perDay: Record<string, { newCount: number; closedCount: number }> = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    labels.push(key)
    perDay[key] = { newCount: 0, closedCount: 0 }
  }
  const [newRows, closedRows] = await Promise.all([
    admin.from('leads').select('created_at').gte('created_at', fromISO).eq('is_deleted', false),
    admin
      .from('lead_status_history')
      .select('created_at')
      .eq('new_status', 'closed')
      .gte('created_at', fromISO),
  ])
  for (const row of (newRows?.data ?? []) as any[]) {
    const key = row.created_at.slice(0, 10)
    if (key in perDay) perDay[key].newCount++
  }
  for (const row of (closedRows?.data ?? []) as any[]) {
    const key = row.created_at.slice(0, 10)
    if (key in perDay) perDay[key].closedCount++
  }
  return labels.map((d) => ({ date: d, count: perDay[d].newCount, closed: perDay[d].closedCount }))
}

export async function getClosedPerDay(days = 7) {
  const res = await getLeadsPerDay(days)
  return res.map((r: any) => ({ date: r.date, count: r.closed ?? 0 }))
}

export async function adminGetAllLeads(params: {
  statuses?: LeadStatus[]
  availability?: 'available' | 'assigned'
  sellerId?: string
  search?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  isOnHold?: boolean
  product?: ProductType[]
  source?: string
} = {}) {
  const admin = createAdminClient()
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 25

  let query: any = admin
    .from('leads')
    .select(
      `*, assigned_user:users!leads_assigned_user_id_fkey!left(id, full_name)`,
      { count: 'exact' } as any,
    )
    .eq('is_deleted', false)

  if (params.statuses && params.statuses.length > 0) {
    query = query.in('status', params.statuses)
  }
  if (params.availability === 'available') {
    query = query.is('assigned_user_id', null)
  } else if (params.availability === 'assigned') {
    query = query.not('assigned_user_id', 'is', null)
  }
  if (params.sellerId) {
    query = query.eq('assigned_user_id', params.sellerId)
  }
  if (typeof params.isOnHold === 'boolean') {
    query = query.eq('is_on_hold', params.isOnHold)
  }
  if (params.product && params.product.length > 0) {
    query = query.in('product', params.product)
  }
  if (params.source) {
    query = query.eq('source', params.source)
  }
  if (params.search) {
    const s = `%${params.search}%`
    query = query.or(
      `first_name.ilike.${s},last_name.ilike.${s},phone.ilike.${s},email.ilike.${s},id.eq.${params.search}`,
    )
  }
  if (params.from) {
    query = query.gte('created_at', new Date(params.from).toISOString())
  }
  if (params.to) {
    query = query.lte('created_at', new Date(params.to + 'T23:59:59').toISOString())
  }
  const sortBy = params.sortBy ?? 'created_at'
  const sortDir = params.sortDir ?? 'desc'
  query = query.order(sortBy, { ascending: sortDir === 'asc' })

  const fromIdx = (page - 1) * pageSize
  const { data, count, error } = await (query.range(fromIdx, fromIdx + pageSize - 1) as any)
  if (error) throw error
  const userIds = (data as any[]).map((r) => r.assigned_user?.id).filter(Boolean)
  if (userIds.length > 0) {
    const emailMap = await getUserEmailMap(userIds)
    for (const row of data as any[]) {
      if (row.assigned_user?.id) {
        row.assigned_user.email = emailMap.get(row.assigned_user.id) ?? ''
      }
    }
  }
  return { data: data as Lead[], count: count ?? 0, page, pageSize }
}

export async function adminAssignLeadToSeller(
  leadId: string,
  sellerId: string,
  byUserId: string,
  debitTokens: boolean = true,
) {
  const admin = createAdminClient()
  const { error } = await admin.rpc('assign_lead_to_seller', {
    p_lead_id: leadId,
    p_seller_id: sellerId,
    p_by_user_id: byUserId,
    p_debit_tokens: debitTokens,
  })
  if (error) {
    const code =
      error.message === 'LEAD_NOT_FOUND' ||
      error.message === 'ALREADY_ASSIGNED' ||
      error.message === 'WALLET_NOT_FOUND' ||
      error.message === 'NOT_ENOUGH_TOKENS' ||
      error.message === 'SELLER_NOT_FOUND' ||
      error.message === 'SELLER_INACTIVE'
        ? error.message
        : error.message || 'Zuweisung fehlgeschlagen.'
    throw new Error(code)
  }
  await logAudit(byUserId, 'LEAD_ASSIGNED', 'lead', leadId, {
    to_user: sellerId,
    via: 'admin_manual',
    debit_tokens: debitTokens,
  })
}

export async function adminResetLead(leadId: string, byUserId: string, refund: boolean = true) {
  const admin = createAdminClient()
  const { data: lead } = await admin.from('leads').select('id, assigned_user_id').eq('id', leadId).maybeSingle()
  const prevUser = (lead as any)?.assigned_user_id

  const { error } = await admin.rpc('reset_lead', {
    p_lead_id: leadId,
    p_by_user_id: byUserId,
    p_refund: refund,
  })
  if (error) {
    const code = error.message === 'LEAD_NOT_FOUND' ? error.message : error.message || 'Zurücksetzen fehlgeschlagen.'
    throw new Error(code)
  }

  if (prevUser && refund) {
    const { data: wallet } = await admin.from('token_wallets').select('id').eq('user_id', prevUser).maybeSingle()
    if (wallet) {
      await logAudit(byUserId, 'TOKEN_CREDIT', 'token_wallet', (wallet as any).id, { lead_id: leadId })
    }
  }
  await logAudit(byUserId, 'LEAD_RESET', 'lead', leadId, { prev_user: prevUser, refund })
}

export async function getSellerPerformance(sellerId: string) {
  const admin = createAdminClient()
  const [leads, closed, lost, contactAttempts, contactedQ] = await Promise.all([
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_user_id', sellerId).eq('is_deleted', false),
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_user_id', sellerId).eq('status', 'closed').eq('is_deleted', false),
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_user_id', sellerId).in('status', ['no_interest', 'wrong_data', 'canceled']).eq('is_deleted', false),
    admin.from('contact_attempts').select('id', { count: 'exact', head: true }).eq('user_id', sellerId),
    admin
      .from('contact_attempts')
      .select('lead_id', { count: 'exact', head: true })
      .eq('user_id', sellerId),
  ])
  const c = closed.count ?? 0
  const l = lost.count ?? 0
  const total = leads.count ?? 0
  const quote = (c + l) > 0 ? c / (c + l) : 0
  const avg = total > 0 ? (contactAttempts.count ?? 0) / total : 0
  return {
    leads_total: total,
    abschlüsse: c,
    verloren: l,
    abschluss_quote: quote,
    kontaktversuche: contactAttempts.count ?? 0,
    durchschnitt_kontakte: avg,
    kontaktierte_leads: Math.min(total, contactedQ.count ?? 0),
  }
}

export async function getAuditLogs(limit = 200) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('audit_logs')
    .select(`*, user:users(id, full_name)`)
    .order('created_at', { ascending: false })
    .limit(limit)
  const rows = (data ?? []) as any[]
  if (!rows.length) return rows
  const userIds = rows.filter((r: any) => r.user?.id).map((r: any) => r.user.id as string)
  const emailMap = await getUserEmailMap(userIds)
  return rows.map((r) => withEmail(r, emailMap, 'user'))
}

export async function getStatistics(sellerId?: string, fromDate?: string, toDate?: string) {
  const admin = createAdminClient()
  let leadsQ = admin.from('leads').select('id, status, assigned_user_id', { count: 'planned' }).eq('is_deleted', false)
  let contactsQ = admin.from('contact_attempts').select('id, result, user_id, lead_id', { count: 'planned' })
  let callbacksQ = admin.from('callbacks').select('id, status', { count: 'planned' })

  if (sellerId) {
    leadsQ = leadsQ.eq('assigned_user_id', sellerId) as typeof leadsQ
    contactsQ = contactsQ.eq('user_id', sellerId) as typeof contactsQ
    callbacksQ = callbacksQ.eq('user_id', sellerId) as typeof callbacksQ
  }
  if (fromDate) {
    leadsQ = leadsQ.gte('created_at', fromDate) as typeof leadsQ
  }
  if (toDate) {
    leadsQ = leadsQ.lte('created_at', toDate + 'T23:59:59') as typeof leadsQ
  }

  const [leadsRes, contactsRes, callbacksRes] = await Promise.all([leadsQ, contactsQ, callbacksQ])
  const leads = (leadsRes.data ?? []) as Lead[]
  const contacts = contactsRes.data ?? []
  const callbacks = callbacksRes.data ?? []

  const erreichteResults = ['rueckruf', 'interessiert', 'kein_interesse']
  const erreichte = contacts.filter((c: any) => erreichteResults.includes(c.result)).length
  const abgeschlossen = leads.filter((l) => l.status === 'closed').length
  const verloren = leads.filter((l) => ['no_interest', 'wrong_data', 'canceled'].includes(l.status)).length
  const angebote = leads.filter((l) => l.status === 'offer').length
  const rueckrufe = leads.filter((l) => l.status === 'callback').length

  const leadUserIds = new Set(leads.map((l) => l.assigned_user_id).filter(Boolean))
  const kontaktierteLeads = new Set((contacts as any[]).map((c) => c.lead_id)).size
  const uniqueLeads = leads.length
  const kontaktQuote = uniqueLeads > 0 ? kontaktierteLeads / uniqueLeads : 0
  const abschlussQuote = (abgeschlossen + verloren) > 0 ? abgeschlossen / (abgeschlossen + verloren) : 0
  const kontaktVersucheProLead = kontaktierteLeads > 0 ? contacts.length / kontaktierteLeads : 0

  return {
    leads: leads.length,
    kontaktversuche: contacts.length,
    erreichte_kunden: erreichte,
    rueckrufe: callbacks.filter((c: any) => c.status === 'offen').length,
    angebote,
    abschlüsse: abgeschlossen,
    verlorene_leads: verloren,
    abschluss_quote: abschlussQuote,
    kontakt_quote: kontaktQuote,
    durchschnitt_kontakte_pro_lead: kontaktVersucheProLead,
  }
}

export async function getSellerLeads(sellerId: string, limit = 100) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('leads')
    .select('*')
    .eq('assigned_user_id', sellerId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as any[]
}

export async function getAuditLogsForUser(userId: string, limit = 200) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('audit_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as any[]
}

export async function adminCreateLead(input: any, byUserId: string, assignToSellerId?: string, debitTokens = true): Promise<{id: string}> {
  const admin = createAdminClient()
  const toInsert: any = {
    first_name: input.first_name,
    last_name: input.last_name,
    phone: input.phone,
    email: input.email || null,
    street: input.street || null,
    zip: input.zip || null,
    city: input.city || null,
    product: input.product,
    power_consumption: input.power_consumption ? Number(input.power_consumption) : null,
    gas_consumption: input.gas_consumption ? Number(input.gas_consumption) : null,
    source: input.source,
    campaign_id: input.campaign_id || null,
    notes: input.notes || null,
    status: 'new',
    token_cost: 1,
    created_by: byUserId,
  }
  const { data, error } = await admin.from('leads').insert(toInsert).select('id').limit(1).maybeSingle()
  if (error) throw error
  const id = (data as any).id
  await logAudit(byUserId, 'LEAD_CREATED', 'lead', id, { source: toInsert.source })
  if (assignToSellerId) {
    await adminAssignLeadToSeller(id, assignToSellerId, byUserId, debitTokens)
  }
  return { id }
}

export async function toggleLeadHold(leadId: string, byUserId: string, isOnHold: boolean, holdNotes?: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('leads').update({ is_on_hold: isOnHold, hold_notes: holdNotes ?? null }).eq('id', leadId)
  if (error) throw error
  await logAudit(byUserId, 'LEAD_HOLD_UPDATED', 'lead', leadId, { is_on_hold: isOnHold, hold_notes: holdNotes ?? null })
}

export async function getAllCampaigns() {
  const admin = createAdminClient()
  const { data } = await admin.from('campaigns').select('*').order('created_at', { ascending: false })
  return (data ?? []) as any[]
}

export async function getCampaignsWithStats() {
  const admin = createAdminClient()
  const campaigns = await getAllCampaigns()
  const campaignIds = campaigns.map((c: any) => c.id)
  if (campaignIds.length === 0) return []

  const { data: leads } = await admin
    .from('leads')
    .select('campaign_id, status, assigned_user_id')
    .in('campaign_id', campaignIds)
    .eq('is_deleted', false)

  const leadCounts: Record<string, any> = {}
  for (const row of (leads ?? []) as any[]) {
    const cid = row.campaign_id
    if (!cid) continue
    if (!leadCounts[cid]) {
      leadCounts[cid] = { total: 0, assigned: 0, offer: 0, closed: 0, powerSum: 0, gasSum: 0, powerCount: 0, gasCount: 0 }
    }
    leadCounts[cid].total++
    if (row.assigned_user_id) leadCounts[cid].assigned++
    if (row.status === 'offer') leadCounts[cid].offer++
    if (row.status === 'closed') leadCounts[cid].closed++
  }

  const { data: consumptions } = await admin
    .from('leads')
    .select('campaign_id, power_consumption, gas_consumption')
    .in('campaign_id', campaignIds)
    .eq('is_deleted', false)

  for (const row of (consumptions ?? []) as any[]) {
    const cid = row.campaign_id
    if (!cid) continue
    if (!leadCounts[cid]) leadCounts[cid] = { total: 0, assigned: 0, offer: 0, closed: 0, powerSum: 0, gasSum: 0, powerCount: 0, gasCount: 0 }
    if (row.power_consumption) {
      leadCounts[cid].powerSum += row.power_consumption
      leadCounts[cid].powerCount++
    }
    if (row.gas_consumption) {
      leadCounts[cid].gasSum += row.gas_consumption
      leadCounts[cid].gasCount++
    }
  }

  return campaigns.map((c: any) => {
    const s = leadCounts[c.id] || { total: 0, assigned: 0, offer: 0, closed: 0, powerSum: 0, gasSum: 0, powerCount: 0, gasCount: 0 }
    const avgPower = s.powerCount > 0 ? Math.round(s.powerSum / s.powerCount) : null
    const avgGas = s.gasCount > 0 ? Math.round(s.gasSum / s.gasCount) : null
    const quote = s.total > 0 ? s.closed / s.total : 0
    return { ...c, stats: { ...s, avgPower, avgGas, quote } }
  })
}

export async function createCampaign(input: any, byUserId: string) {
  const admin = createAdminClient()
  const toInsert: any = {
    name: input.name,
    source: input.source || null,
    is_active: input.is_active !== false,
    budget_amount: input.budget_amount ? Number(input.budget_amount) : null,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    created_by: byUserId,
  }
  const { data, error } = await admin.from('campaigns').insert(toInsert).select().limit(1).maybeSingle()
  if (error) throw error
  await logAudit(byUserId, 'ADMIN_CHANGE', 'campaign', (data as any).id, { action: 'create' })
  return data
}

export async function updateCampaign(campaignId: string, patch: any, byUserId: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('campaigns').update({ ...patch, updated_by: byUserId }).eq('id', campaignId)
  if (error) throw error
  await logAudit(byUserId, 'ADMIN_CHANGE', 'campaign', campaignId, { action: 'update', patch })
}

export async function getDashboardStatsExtended(days: number = 14) {
  const admin = createAdminClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const fromDate = new Date(today)
  fromDate.setDate(fromDate.getDate() - days + 1)
  const fromISO = fromDate.toISOString()
  const todayISO = today.toISOString()
  const yesterdayISO = yesterday.toISOString()

  function dayKey(d: Date) {
    return d.toISOString().slice(0, 10)
  }

  const labels: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    labels.push(dayKey(d))
  }

  const [newLeadsRows, closedRows, debitRows, sellersNow] = await Promise.all([
    admin.from('leads').select('created_at').gte('created_at', fromISO).eq('is_deleted', false),
    admin.from('lead_status_history').select('created_at').eq('new_status', 'closed').gte('created_at', fromISO),
    admin.from('token_transactions').select('created_at, amount').lt('amount', 0).gte('created_at', fromISO),
    getAdminDashboardStats(),
  ])

  const spark: Record<string, { newLeads: number; closed: number; tokensDebit: number }> = {}
  for (const l of labels) spark[l] = { newLeads: 0, closed: 0, tokensDebit: 0 }
  for (const r of (newLeadsRows.data ?? []) as any[]) {
    const k = r.created_at.slice(0, 10)
    if (spark[k]) spark[k].newLeads++
  }
  for (const r of (closedRows.data ?? []) as any[]) {
    const k = r.created_at.slice(0, 10)
    if (spark[k]) spark[k].closed++
  }
  for (const r of (debitRows.data ?? []) as any[]) {
    const k = r.created_at.slice(0, 10)
    if (spark[k]) spark[k].tokensDebit += Math.abs(Number(r.amount ?? 0))
  }
  const sparklineValues = labels.map((k) => spark[k])

  function countInRange(rows: any[], fromISO: string, toISO: string) {
    let c = 0
    const fromMs = new Date(fromISO).getTime()
    const toMs = new Date(toISO).getTime() + 86400000
    for (const r of rows) {
      const t = new Date(r.created_at).getTime()
      if (t >= fromMs && t < toMs) c++
    }
    return c
  }

  function debitInRange(rows: any[], fromISO: string, toISO: string) {
    let s = 0
    const fromMs = new Date(fromISO).getTime()
    const toMs = new Date(toISO).getTime() + 86400000
    for (const r of rows) {
      const t = new Date(r.created_at).getTime()
      if (t >= fromMs && t < toMs) s += Math.abs(Number(r.amount ?? 0))
    }
    return s
  }

  const newToday = countInRange(newLeadsRows.data ?? [], todayISO, todayISO)
  const newYesterday = countInRange(newLeadsRows.data ?? [], yesterdayISO, yesterdayISO)
  const closedToday = countInRange(closedRows.data ?? [], todayISO, todayISO)
  const closedYesterday = countInRange(closedRows.data ?? [], yesterdayISO, yesterdayISO)
  const debitToday = debitInRange(debitRows.data ?? [], todayISO, todayISO)
  const debitYesterday = debitInRange(debitRows.data ?? [], yesterdayISO, yesterdayISO)

  const delta = (cur: number, prev: number) => {
    if (prev === 0) return cur === 0 ? 0 : 100
    return Math.round(((cur - prev) / prev) * 1000) / 10
  }

  const capacityPerSeller = 50
  const assigned = sellersNow.assigned_leads ?? 0
  const sellers = sellersNow.active_sellers ?? 1
  const capacity = assigned / (sellers * capacityPerSeller)

  return {
    base: sellersNow,
    deltas: {
      new_leads_today_pct: delta(newToday, newYesterday),
      closed_leads_today_count: closedToday,
      closed_leads_yesterday_count: closedYesterday,
      closed_leads_today_pct: delta(closedToday, closedYesterday),
      tokens_debit_today: debitToday,
      tokens_debit_yesterday: debitYesterday,
      tokens_debit_today_pct: delta(debitToday, debitYesterday),
    },
    sparklines: sparklineValues,
    capacity: {
      assigned,
      max: sellers * capacityPerSeller,
      ratio: Math.min(1, capacity),
      pct: Math.round(capacity * 100),
    },
  }
}

export async function getTokenBurnRate(days: number = 30) {
  const admin = createAdminClient()
  const from = new Date()
  from.setDate(from.getDate() - days + 1)
  from.setHours(0, 0, 0, 0)
  const fromISO = from.toISOString()

  const labels: string[] = []
  const perDay: Record<string, number> = {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const k = d.toISOString().slice(0, 10)
    labels.push(k)
    perDay[k] = 0
  }

  const { data } = await admin
    .from('token_transactions')
    .select('created_at, amount')
    .lt('amount', 0)
    .gte('created_at', fromISO)

  for (const r of (data ?? []) as any[]) {
    const k = r.created_at.slice(0, 10)
    if (k in perDay) perDay[k] += Math.abs(Number(r.amount ?? 0))
  }

  const values = labels.map((k) => ({ date: k, value: perDay[k] }))
  const movingAvg: number[] = []
  const window = 7
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1)
    const slice = values.slice(start, i + 1)
    movingAvg.push(Math.round((slice.reduce((s, v) => s + v.value, 0) / slice.length) * 10) / 10)
  }
  const totalBurn = values.reduce((s, v) => s + v.value, 0)
  const avgDaily = values.length > 0 ? Math.round((totalBurn / values.length) * 10) / 10 : 0
  return { series: values.map((v, i) => ({ ...v, ma: movingAvg[i] })), totalBurn, avgDaily }
}

export async function getSellerActivityStatuses() {
  const admin = createAdminClient()
  const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .from('audit_logs')
    .select('user_id, created_at')
    .gte('created_at', threshold)
  const userIds = new Set<string>()
  for (const r of (data ?? []) as any[]) if (r.user_id) userIds.add(r.user_id)
  return new Set([...userIds])
}

export async function getAuditLogsFiltered(params: {
  actionType?: string
  userId?: string
  resourceType?: string
  from?: string
  to?: string
  search?: string
  limit?: number
  page?: number
} = {}) {
  const admin = createAdminClient()
  const limit = params.limit ?? 500
  const page = params.page ?? 1
  const fromIdx = (page - 1) * limit

  let q: any = admin
    .from('audit_logs')
    .select(`*, user:users(id, full_name)`, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (params.actionType) q = q.eq('action', params.actionType)
  if (params.userId) q = q.eq('user_id', params.userId)
  if (params.resourceType) q = q.eq('resource_type', params.resourceType)
  if (params.from) q = q.gte('created_at', new Date(params.from).toISOString())
  if (params.to) q = q.lte('created_at', new Date(params.to + 'T23:59:59').toISOString())
  if (params.search) {
    const s = `%${params.search}%`
    q = q.or(`resource_id.ilike.${s}, details::text.ilike.${s}`)
  }
  q = q.range(fromIdx, fromIdx + limit - 1)

  const res = await q
  const rows = (res.data ?? []) as any[]
  if (rows.length) {
    const ids = rows.filter((r) => r.user?.id).map((r) => r.user.id as string)
    if (ids.length) {
      const emailMap = await getUserEmailMap(ids)
      for (const r of rows) {
        if (r.user?.id) r.user.email = emailMap.get(r.user.id) ?? ''
      }
    }
  }
  return { rows, count: res.count ?? rows.length }
}

export async function getCancellationRequests(status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending') {
  const admin = createAdminClient()
  // Versuch 1: Mit allen JOINs (leads, requester, approver)
  try {
    let q: any = admin
      .from('lead_cancellation_requests')
      .select(`
        *,
        lead:leads(id, first_name, last_name, product, status, assigned_user_id, token_cost, campaign_id),
        requester:users(id, full_name, email),
        approver:users(id, full_name, email)
      `, { head: false, count: 'exact' })
      .order('created_at', { ascending: false })
    if (status !== 'all') q = q.eq('status', status)
    const res = await q
    if (res.error) {
      // eslint-disable-next-line no-console
      console.error('[getCancellationRequests] Query (mit JOINs) FEHLER:', res.error)
      throw res.error
    }
    return (res.data ?? []) as any[]
  } catch (e1: any) {
    // Versuch 2: OHNE JOINs (nur nackte Tabelle) – falls Schema in DB nicht vollständig ist
    // eslint-disable-next-line no-console
    console.warn('[getCancellationRequests] Fallback: Lese Stornos ohne JOINs. Fehler war:', e1.message)
    let q2: any = admin
      .from('lead_cancellation_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (status !== 'all') q2 = q2.eq('status', status)
    const res2 = await q2
    if (res2.error) {
      // eslint-disable-next-line no-console
      console.error('[getCancellationRequests] Fallback (ohne JOINs) FEHLER:', res2.error)
      throw new Error(`Konnte Stornos nicht laden: ${res2.error?.message ?? 'Unbekannt'}`)
    }
    const rows = (res2.data ?? []) as any[]
    // Jetzt minimal Join: Lead-Namen + Requester nachschlagen
    if (rows.length > 0) {
      const leadIds = Array.from(new Set(rows.map((r) => r.lead_id).filter(Boolean)))
      const userIds = Array.from(new Set([
        ...rows.map((r) => r.requested_by).filter(Boolean),
        ...rows.map((r) => r.reviewed_by).filter(Boolean),
      ]))
      const [leadsMap, usersMap] = await Promise.all([
        (async () => {
          if (leadIds.length === 0) return new Map()
          const { data, error } = await admin.from('leads').select('id,first_name,last_name,product,status,assigned_user_id,token_cost,campaign_id').in('id', leadIds)
          if (error || !data) return new Map()
          return new Map((data as any[]).map((l) => [l.id, l]))
        })(),
        (async () => {
          if (userIds.length === 0) return new Map()
          const { data, error } = await admin.from('users').select('id,full_name,email').in('id', userIds)
          if (error || !data) return new Map()
          return new Map((data as any[]).map((u) => [u.id, u]))
        })(),
      ])
      for (const r of rows) {
        r.lead = leadsMap.get(r.lead_id) ?? null
        r.requester = usersMap.get(r.requested_by) ?? null
        r.approver = usersMap.get(r.reviewed_by) ?? null
      }
    }
    return rows
  }
}

export async function getCancellationForLead(leadId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lead_cancellation_requests')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[getCancellationForLead] FEHLER (lead_id=${leadId}):`, error)
    return null
  }
  return data as any | null
}

export async function adminSoftDeleteLead(leadId: string, byUserId: string, reason: string = '') {
  const admin = createAdminClient()
  const { data: lead } = await admin.from('leads').select('*').eq('id', leadId).maybeSingle()
  if (!lead) throw new Error('LEAD_NOT_FOUND')
  const { error } = await admin.from('leads').update({
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: byUserId,
    deletion_reason: reason || null,
  }).eq('id', leadId)
  if (error) throw error
  await logAudit(byUserId, 'LEAD_DELETED', 'lead', leadId, { reason })
  return true
}

export async function requestCancellation(leadId: string, byUserId: string, reason: string) {
  const admin = createAdminClient()
  const { data: lead, error: leadError } = await admin.from('leads').select('assigned_user_id').eq('id', leadId).maybeSingle()
  if (leadError) {
    // eslint-disable-next-line no-console
    console.error('[requestCancellation] Fehler bei Lead Abfrage:', leadError)
    throw new Error(`DB Fehler: ${leadError.message}`)
  }
  if (!lead) throw new Error('LEAD_NOT_FOUND')
  const l = lead as any
  if (l.assigned_user_id !== byUserId) throw new Error('NOT_YOUR_LEAD')
  const { data: existing, error: existingErr } = await admin
    .from('lead_cancellation_requests')
    .select('id')
    .eq('lead_id', leadId)
    .eq('status', 'pending')
    .maybeSingle()
  if (existingErr) {
    // eslint-disable-next-line no-console
    console.error('[requestCancellation] Fehler bei Check:', existingErr)
    throw new Error(`DB Fehler: ${existingErr.message}`)
  }
  if (existing) throw new Error('ALREADY_REQUESTED')
  const { error } = await admin.from('lead_cancellation_requests').insert({
    lead_id: leadId,
    requested_by: byUserId,
    reason: reason || 'Kein Grund angegeben',
    status: 'pending',
  })
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[requestCancellation] INSERT FEHLER:', error)
    throw new Error(`INSERT Fehler: ${error.message}`)
  }
  await logAudit(byUserId, 'LEAD_CANCEL_REQUEST', 'lead', leadId, { reason })
  return true
}

export async function reviewCancellation(requestId: string, byUserId: string, approve: boolean, refundTokens: boolean, reason: string = '') {
  const admin = createAdminClient()
  const { data: req, error: reqErr } = await admin.from('lead_cancellation_requests').select('*').eq('id', requestId).maybeSingle()
  if (reqErr) {
    // eslint-disable-next-line no-console
    console.error('[reviewCancellation] Fehler bei Abfrage:', reqErr)
    throw new Error(`DB Fehler: ${reqErr.message}`)
  }
  if (!req) throw new Error('REQUEST_NOT_FOUND')
  const r = req as any
  if (r.status !== 'pending') throw new Error('ALREADY_REVIEWED')
  const updates: any = {
    status: approve ? 'approved' : 'rejected',
    reviewed_by: byUserId,
    reviewed_at: new Date().toISOString(),
    review_notes: reason || null,
    refund_tokens: !!refundTokens,
  }
  const { error } = await admin.from('lead_cancellation_requests').update(updates).eq('id', requestId)
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[reviewCancellation] UPDATE FEHLER:', error)
    throw new Error(`UPDATE Fehler: ${error.message}`)
  }

  if (approve) {
    const { data: lead, error: leadErr } = await admin.from('leads').select('assigned_user_id, token_cost').eq('id', r.lead_id).maybeSingle()
    if (leadErr) {
      // eslint-disable-next-line no-console
      console.error('[reviewCancellation] Lead Abbruch FEHLER (Review trotzdem OK!):', leadErr)
    }
    const l = lead as any
    const { error: lerr } = await admin.from('leads').update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: byUserId,
      deletion_reason: `Storno genehmigt: ${reason || r.reason || '-'}`,
    }).eq('id', r.lead_id)
    if (lerr) {
      // eslint-disable-next-line no-console
      console.error('[reviewCancellation] Lead soft-delete FEHLER (Review trotzdem OK!):', lerr)
    }
    if (refundTokens && l?.assigned_user_id && l?.token_cost) {
      try {
        await admin.rpc('credit_tokens', {
          p_target_user_id: l.assigned_user_id,
          p_amount: Number(l.token_cost),
          p_reason: `Stornierung Lead #${r.lead_id.slice(0, 8)}`,
          p_type: 'rueckerstattung',
          p_created_by: byUserId,
        })
      } catch (rpcErr: any) {
        // eslint-disable-next-line no-console
        console.error('[reviewCancellation] credit_tokens RPC FEHLER:', rpcErr)
      }
    }
    await logAudit(byUserId, 'LEAD_CANCEL_APPROVED', 'lead', r.lead_id, { refundTokens, reason })
  } else {
    await logAudit(byUserId, 'LEAD_CANCEL_REJECTED', 'lead', r.lead_id, { reason })
  }
  return true
}

export type LandingLeadFilters = {
  search?: string
  product?: ProductType[]
  consultation?: 'all' | 'yes' | 'no'
  assignment?: 'all' | 'available' | 'assigned'
  statuses?: LeadStatus[]
  from?: string
  to?: string
  zip?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

function startOfDayUTC(d: Date) {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

function addDaysUTC(d: Date, days: number) {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + days)
  return x
}

export async function getLandingLeadsDashboardStats() {
  const admin = createAdminClient()
  const today = new Date()
  const todayStart = startOfDayUTC(today).toISOString()
  const yesterdayStart = startOfDayUTC(addDaysUTC(today, -1)).toISOString()
  const todayEnd = startOfDayUTC(addDaysUTC(today, 1)).toISOString()

  const filters: any = [{ field: 'source', op: 'in', value: ['landing_page', 'sonstiges'] }]
  const safeLandingFilter = (q: any) => {
    try {
      return q
        .eq('is_deleted', false)
        .or('source.eq.landing_page,source.eq.sonstiges')
    } catch {
      return q
        .eq('is_deleted', false)
        .ilike('notes', '%Landing Page%')
    }
  }

  const [
    totalRes,
    todayRes,
    yesterdayRes,
    withConsultationRes,
    assignedRes,
    contactedRes,
    productsRes,
    perDay7Res,
    zipBucketsRes,
    campaignsRes,
  ] = await Promise.all([
    safeLandingFilter(admin.from('leads').select('id', { count: 'exact', head: true } as any)),
    safeLandingFilter(
      admin
        .from('leads')
        .select('id', { count: 'exact', head: true } as any)
        .gte('created_at', todayStart)
        .lt('created_at', todayEnd),
    ),
    safeLandingFilter(
      admin
        .from('leads')
        .select('id', { count: 'exact', head: true } as any)
        .gte('created_at', yesterdayStart)
        .lt('created_at', todayStart),
    ),
    safeLandingFilter(
      admin
        .from('leads')
        .select('id', { count: 'exact', head: true } as any)
        .ilike('notes', '%Beratungsgespräch gewünscht%'),
    ),
    safeLandingFilter(
      admin
        .from('leads')
        .select('id', { count: 'exact', head: true } as any)
        .neq('assigned_user_id', null as any),
    ),
    safeLandingFilter(
      admin
        .from('leads')
        .select('id', { count: 'exact', head: true } as any)
        .in('status', ['contacted', 'callback', 'offer', 'closed'] as any),
    ),
    safeLandingFilter(
      admin.from('leads').select('id, product, power_consumption, gas_consumption'),
    ),
    safeLandingFilter(
      admin
        .from('leads')
        .select('created_at')
        .gte('created_at', startOfDayUTC(addDaysUTC(today, -6)).toISOString()),
    ),
    safeLandingFilter(admin.from('leads').select('zip').neq('zip', '')),
    safeLandingFilter(
      admin.from('leads').select('campaign_id, id').neq('campaign_id', '' as any),
    ),
  ])

  const todayCount = Number(todayRes.count ?? 0)
  const yesterdayCount = Number(yesterdayRes.count ?? 0)
  const deltaNewToday =
    yesterdayCount === 0 ? (todayCount === 0 ? 0 : 100) : Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 1000) / 10

  const total = Number(totalRes.count ?? 0)
  const consultationCount = Number(withConsultationRes.count ?? 0)
  const consultationRate = total === 0 ? 0 : Math.round((consultationCount / total) * 1000) / 10

  const assignedCount = Number(assignedRes.count ?? 0)
  const contactedCount = Number(contactedRes.count ?? 0)

  let avgSavingsEstimateEur = 0
  let considered = 0
  for (const r of (productsRes.data ?? []) as any[]) {
    const product = r.product as ProductType
    let euro = 0
    const hasP = product === 'strom' || product === 'beides'
    const hasG = product === 'gas' || product === 'beides'
    if (hasP && r.power_consumption) {
      euro += (Number(r.power_consumption) * 4) / 100
    }
    if (hasG && r.gas_consumption) {
      euro += (Number(r.gas_consumption) * 2) / 100
    }
    if (euro > 0) {
      avgSavingsEstimateEur += euro
      considered++
    }
  }
  if (considered > 0) {
    avgSavingsEstimateEur = Math.round(avgSavingsEstimateEur / considered)
  } else {
    avgSavingsEstimateEur = 420
  }

  const labels: string[] = []
  const sparkIn: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = startOfDayUTC(addDaysUTC(today, -i))
    const k = d.toISOString().slice(0, 10)
    labels.push(k)
    sparkIn[k] = 0
  }
  for (const r of (perDay7Res.data ?? []) as any[]) {
    const k = String(r.created_at ?? '').slice(0, 10)
    if (k in sparkIn) sparkIn[k]++
  }
  const perDayLast7 = labels.map((date) => ({ date, count: sparkIn[date] ?? 0 }))

  const productCounts: Record<ProductType, number> = { strom: 0, gas: 0, beides: 0 }
  for (const r of (productsRes.data ?? []) as any[]) {
    const p = r.product as ProductType
    if (p === 'strom' || p === 'gas' || p === 'beides') productCounts[p]++
  }

  const zipCounts: Record<string, number> = {}
  for (const r of (zipBucketsRes.data ?? []) as any[]) {
    const z = String(r.zip ?? '').trim()
    if (!z) continue
    zipCounts[z] = (zipCounts[z] ?? 0) + 1
  }
  const topZips = Object.entries(zipCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([zip, count]) => ({ zip, count }))

  const campaignCounts: Record<string, number> = {}
  for (const r of (campaignsRes.data ?? []) as any[]) {
    const cid = String(r.campaign_id ?? '')
    if (!cid) continue
    campaignCounts[cid] = (campaignCounts[cid] ?? 0) + 1
  }
  const campaignIds = Object.keys(campaignCounts)
  let campaignRows: Array<{ id: string; name: string | null; external_id: string | null; count: number }> = []
  if (campaignIds.length > 0) {
    const { data: camps } = await admin
      .from('campaigns')
      .select('id, name, external_id')
      .in('id', campaignIds)
    for (const c of (camps ?? []) as any[]) {
      campaignRows.push({
        id: c.id,
        name: c.name ?? null,
        external_id: c.external_id ?? null,
        count: campaignCounts[c.id] ?? 0,
      })
    }
  }
  campaignRows = campaignRows.sort((a, b) => b.count - a.count).slice(0, 8)

  return {
    total_leads: total,
    new_today: todayCount,
    new_yesterday: yesterdayCount,
    delta_new_today_pct: deltaNewToday,
    consultation_count: consultationCount,
    consultation_rate_pct: consultationRate,
    assigned_count: assignedCount,
    contacted_count: contactedCount,
    avg_savings_estimate_eur: avgSavingsEstimateEur,
    per_day_last_7: perDayLast7,
    product_counts: productCounts,
    top_zips: topZips,
    top_campaigns: campaignRows,
  }
}

export async function getLandingLeadsList(filters: LandingLeadFilters = {}) {
  const admin = createAdminClient()
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 25

  let query: any = admin
    .from('leads')
    .select(
      `*, assigned_user:users!leads_assigned_user_id_fkey!left(id, full_name), campaign:campaigns(id, name, external_id)`,
      { count: 'exact' } as any,
    )
    .eq('is_deleted', false)

  try {
    query = query.or('source.eq.landing_page,source.eq.sonstiges')
  } catch {
    query = query.ilike('notes', '%Landing Page%')
  }

  if (filters.search) {
    const s = `%${filters.search}%`
    query = query.or(
      `first_name.ilike.${s},last_name.ilike.${s},phone.ilike.${s},email.ilike.${s},city.ilike.${s},zip.ilike.${s}`,
    )
  }
  if (filters.product && filters.product.length > 0) {
    query = query.in('product', filters.product)
  }
  if (filters.assignment === 'available') {
    query = query.eq('assigned_user_id', null)
  } else if (filters.assignment === 'assigned') {
    query = query.neq('assigned_user_id', null as any)
  }
  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in('status', filters.statuses)
  }
  if (filters.from) {
    query = query.gte('created_at', new Date(filters.from).toISOString())
  }
  if (filters.to) {
    query = query.lte('created_at', new Date(filters.to + 'T23:59:59').toISOString())
  }
  if (filters.zip && filters.zip.trim()) {
    query = query.ilike('zip', `%${filters.zip.trim()}%`)
  }
  if (filters.consultation === 'yes') {
    query = query.ilike('notes', '%Beratungsgespräch gewünscht%')
  } else if (filters.consultation === 'no') {
    query = query.not.ilike('notes', '%Beratungsgespräch gewünscht%')
  }

  const sortBy = filters.sortBy ?? 'created_at'
  const sortDir = filters.sortDir ?? 'desc'
  query = query.order(sortBy, { ascending: sortDir === 'asc' })

  const fromIdx = (page - 1) * pageSize
  const { data, count, error } = await (query.range(fromIdx, fromIdx + pageSize - 1) as any)
  if (error) throw error

  const rows = (data ?? []) as any[]

  const userIds = rows.map((r) => r.assigned_user?.id).filter(Boolean)
  if (userIds.length > 0) {
    const emailMap = await getUserEmailMap(userIds)
    for (const r of rows) {
      if (r.assigned_user?.id) {
        r.assigned_user.email = emailMap.get(r.assigned_user.id) ?? ''
      }
    }
  }

  return { rows: rows as Lead[], count: count ?? rows.length, page, pageSize }
}

function getSavingsEstimateForRow(r: any): number {
  const p = r.product as ProductType
  let euro = 0
  const hasP = p === 'strom' || p === 'beides'
  const hasG = p === 'gas' || p === 'beides'
  if (hasP && r.power_consumption) euro += (Number(r.power_consumption) * 4) / 100
  if (hasG && r.gas_consumption) euro += (Number(r.gas_consumption) * 2) / 100
  if (euro === 0) euro = 350
  return Math.max(150, Math.min(900, Math.round(euro)))
}

export async function getLandingLeadsWithExtra(filters: LandingLeadFilters = {}) {
  const list = await getLandingLeadsList(filters)
  const rows = (list.rows as any[]).map((r) => {
    const notes = String(r.notes ?? '')
    const wantsConsultation = notes.includes('Beratungsgespräch gewünscht')
    return {
      ...r,
      wants_consultation: wantsConsultation,
      savings_estimate_eur: getSavingsEstimateForRow(r),
    }
  })
  return { ...list, rows }
}

