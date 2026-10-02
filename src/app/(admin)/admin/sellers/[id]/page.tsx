import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getSellerPerformance,
  getSellerLeads,
  getAuditLogsForUser,
} from '@/lib/services/admin.service'
import { getAllTeams } from '@/lib/services/teams.service'
import { getUserEmailMap, withEmail } from '@/lib/user-emails'
import { SellerDetailClient } from './SellerDetailClient'
import { notFound } from 'next/navigation'

export const metadata = { title: 'Verkäufer · Admin' }

function getMonthlyTargetsMock(perf: any) {
  const months = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun']
  const totalLeads = Math.max(perf.leads_total ?? 0, 5)
  const totalClosed = Math.max(perf.abschlüsse ?? 0, 2)
  return months.map((m, i) => {
    const leadFactor = 0.6 + i * 0.15
    const closedFactor = 0.5 + i * 0.12
    return {
      monat: m,
      Leads: Math.round(totalLeads * (leadFactor / 3 + (i / 6))) || 1,
      Abschlüsse: Math.round(totalClosed * (closedFactor / 3 + (i / 8))) || 0,
    }
  })
}

export default async function AdminSellerDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  await requireAdmin()

  const resolvedParams = (params as any)?.then
    ? await (params as Promise<{ id: string }>)
    : (params as { id: string })

  const userId = resolvedParams?.id
  if (!userId || typeof userId !== 'string' || userId.length < 5) {
    notFound()
  }

  const admin = createAdminClient()

  const [sellerRes, teams, walletRes, perf, leads, audits] = await Promise.all([
    admin
      .from('users')
      .select(`
        *,
        team:teams!users_team_id_fkey!left(id, name, color)
      `)
      .eq('id', userId)
      .maybeSingle(),
    getAllTeams() as Promise<any[]>,
    admin
      .from('token_wallets')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
    getSellerPerformance(userId),
    getSellerLeads(userId, 100),
    getAuditLogsForUser(userId, 200),
  ] as any)

  if ((sellerRes as any)?.error) {
    const err = (sellerRes as any).error
    throw new Error(
      `SELLER_DETAIL_QUERY_ERROR: ${err.message ?? String(err)}${err.details ? ' | ' + err.details : ''}${err.hint ? ' | ' + err.hint : ''}`,
    )
  }
  const sellerRaw = (sellerRes as any)?.data ?? null
  if (!sellerRaw) {
    notFound()
  }

  const emailMap = await getUserEmailMap([userId])
  const sellerWithEmail = withEmail(sellerRaw as any, emailMap)

  const seller = {
    ...sellerWithEmail,
    wallet: (walletRes as any)?.data ?? null,
  }
  const targets = getMonthlyTargetsMock(perf)

  return (
    <SellerDetailClient
      seller={seller}
      teams={teams}
      targets={targets}
      perf={perf}
      leads={leads}
      audits={audits}
    />
  )
}
