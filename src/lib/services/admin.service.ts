import { createAdminClient } from '../supabase/admin'
import { logAudit } from '../audit'
import type { DatabaseUser, Lead, LeadStatus } from '@/types'
import { getUserEmailMap, withEmail } from '../user-emails'

export async function createSeller(
  input: { email: string; password: string; full_name: string; initial_balance?: number; role?: 'admin' | 'seller' },
  createdBy: string,
): Promise<{ userId: string }> {
  const admin = createAdminClient()
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  })
  if (authErr) throw authErr
  if (!authData.user) throw new Error('AUTH_CREATE_FAILED')

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
    admin.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
    admin.from('leads').select('id', { count: 'exact', head: true }).is('assigned_user_id', null),
    admin.from('leads').select('id', { count: 'exact', head: true }).not('assigned_user_id', 'is', null),
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'closed'),
    admin.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('role', 'seller'),
  ])

  const { data: debitRows } = await admin.from('token_transactions').select('amount').lt('amount', 0)
  const debitSum = (debitRows ?? []).reduce((acc, t: any) => acc + (t.amount ?? 0), 0)
  const closed = closedLeads.count ?? 0

  const { count: lost } = await admin
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .in('status', ['no_interest', 'wrong_data', 'canceled'])
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
  const { data } = await admin.from('leads').select('status')
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
    admin.from('leads').select('created_at').gte('created_at', fromISO),
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
  const [leads, closed, lost, contactAttempts] = await Promise.all([
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_user_id', sellerId),
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_user_id', sellerId).eq('status', 'closed'),
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_user_id', sellerId).in('status', ['no_interest', 'wrong_data', 'canceled']),
    admin.from('contact_attempts').select('id', { count: 'exact', head: true }).eq('user_id', sellerId),
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
  let leadsQ = admin.from('leads').select('id, status, assigned_user_id', { count: 'planned' })
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
