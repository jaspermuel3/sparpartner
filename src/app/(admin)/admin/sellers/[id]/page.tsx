import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getSellerPerformance,
  getSellerLeads,
  getAuditLogsForUser,
} from '@/lib/services/admin.service'
import { getAllTeams } from '@/lib/services/teams.service'
import { SellerDetailClient } from './SellerDetailClient'

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
  params: { id: string }
}) {
  await requireAdmin()
  const admin = createAdminClient()
  const userId = params.id

  const [{ data: sellerRaw }, teams, wallet, perf, leads, audits] = await Promise.all([
    admin
      .from('users')
      .select(`
        *,
        team:teams(id, name, color)
      `)
      .eq('id', userId)
      .single(),
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

  const seller = {
    ...(sellerRaw as any),
    wallet: (wallet as any)?.data ?? null,
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
