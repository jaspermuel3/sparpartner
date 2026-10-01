import { requireAdmin } from '@/lib/auth'
import {
  getStatistics,
  getAllSellers,
  getSellerPerformance,
  getAdminDashboardStats,
  getLeadStatusDistribution,
  getCampaignsWithStats,
} from '@/lib/services/admin.service'
import { getAllTeams } from '@/lib/services/teams.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/ui-custom/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Users,
  Phone,
  PhoneCall,
  PhoneForwarded,
  FileSignature,
  CheckCircle2,
  XCircle,
  Target,
  Percent,
  BarChart3,
  Sparkles,
  Funnel,
  TrendingUp,
  Trophy,
  Medal,
  Award,
} from 'lucide-react'
import {
  formatPercent,
  SOURCE_LABELS,
  formatCurrency,
  formatDateShort,
} from '@/lib/constants'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { FunnelChartClient, CampaignPerfTableClient } from './StatsChartComponents'

export const metadata = { title: 'Statistiken · Admin' }

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; seller?: string }
}) {
  await requireAdmin()
  const stats = await getStatistics(searchParams.seller, searchParams.from, searchParams.to)
  const sellers = (await getAllSellers()) as any[] ?? []
  const teams = (await getAllTeams()) as any[] ?? []
  const dashboard = await getAdminDashboardStats()
  const statusDist = await getLeadStatusDistribution()
  const campaigns = await getCampaignsWithStats()

  const totalLeads = Object.values(statusDist).reduce((sum, n) => sum + n, 0) || stats.leads

  // ========== Seller-Ranking Scorecard ==========
  type ScoredSeller = {
    seller: any
    score: number
    rank: number
    perf: any
    team: any
  }
  const teamMap: Record<string, any> = {}
  for (const t of teams) teamMap[t.id] = t

  const sellersWithPerf = await Promise.all(
    sellers.filter((s) => s.role === 'seller').map(async (s) => ({
      seller: s,
      perf: await getSellerPerformance(s.id),
      team: s.team_id ? teamMap[s.team_id] : null,
    })),
  )
  const scoredSellers: ScoredSeller[] = sellersWithPerf
    .map(({ seller, perf, team }) => {
      const p = perf ?? {}
      const abschlQuote = Number(p.abschluss_quote ?? 0)
      const abschl = Number(p.abschlüsse ?? 0)
      const leads = Number(p.leads_total ?? 0)
      const kontaktQuote = leads > 0 ? Number(p.kontaktierte_leads ?? 0) / leads : 0
      const durchschnKontakte = Number(p.durchschnitt_kontakte ?? 0)
      let score = 0
      score += Math.min(100, abschlQuote * 100) * 0.4
      score += Math.min(100, abschl * 5) * 0.2
      score += Math.min(100, kontaktQuote * 100) * 0.25
      score += Math.max(0, 100 - durchschnKontakte * 15) * 0.1
      score += Math.min(100, leads * 2) * 0.05
      return { seller, score: Math.round(score * 10) / 10, rank: 0, perf, team }
    })
    .sort((a, b) => b.score - a.score)
    .map((x, idx) => ({ ...x, rank: idx + 1 }))

  // Lookup for performance rows
  const perfLookup = new Map<string, { score: number; rank: number; perf: any }>()
  for (const s of scoredSellers) perfLookup.set(s.seller.id, { score: s.score, rank: s.rank, perf: s.perf })

  const top3 = scoredSellers.slice(0, 3)
  const avgScore = scoredSellers.length > 0
    ? scoredSellers.reduce((s, x) => s + x.score, 0) / scoredSellers.length
    : 0

  function rankBadge(rank: number): string {
    if (rank === 1) return 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white border-amber-500'
    if (rank === 2) return 'bg-gradient-to-br from-slate-300 to-slate-400 text-white border-slate-400'
    if (rank === 3) return 'bg-gradient-to-br from-amber-700 to-orange-700 text-white border-amber-800'
    return 'bg-slate-100 text-slate-600 border-slate-200'
  }
  function rankIcon(rank: number) {
    if (rank === 1) return <Trophy className="h-3.5 w-3.5" />
    if (rank === 2) return <Medal className="h-3.5 w-3.5" />
    if (rank === 3) return <Award className="h-3.5 w-3.5" />
    return <span className="text-[10px] font-bold tabular-nums">#{rank}</span>
  }

  const funnelData = [
    {
      name: 'Neue Leads',
      value: totalLeads,
      fill: '#0f172a',
    },
    {
      name: 'Zugewiesen',
      value: dashboard.assigned_leads ?? 0,
      fill: '#1d4ed8',
    },
    {
      name: 'Erreicht',
      value: stats.erreichte_kunden,
      fill: '#0ea5e9',
    },
    {
      name: 'Angebot',
      value: stats.angebote,
      fill: '#6366f1',
    },
    {
      name: 'Abgeschlossen',
      value: stats.abschlüsse,
      fill: '#10b981',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Statistiken' },
        ]}
        title="Statistiken"
        description="Kennzahlen für das gesamte System – pro Verkäufer und Zeitraum filterbar."
      />

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <form className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
            <div className="md:col-span-5 space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Verkäufer</label>
              <select
                name="seller"
                defaultValue={searchParams.seller ?? ''}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="">Alle Verkäufer</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name ?? s.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Von</label>
              <input
                type="date"
                name="from"
                defaultValue={searchParams.from}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Bis</label>
              <input
                type="date"
                name="to"
                defaultValue={searchParams.to}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div className="md:col-span-1">
              <button
                type="submit"
                className="h-10 w-full rounded-lg bg-slate-900 px-3 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
              >
                OK
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ============ Seller-Ranking Scorecard (Top 3) ============ */}
      {scoredSellers.length > 0 && (
        <Card className="border-slate-200 bg-gradient-to-br from-white via-slate-50 to-indigo-50/30 shadow-sm overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5" />
                  Seller-Ranking
                </div>
                <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                  Top-Performer im Scorecard-System
                </div>
                <div className="text-xs text-slate-500 mt-1 hidden sm:block">
                  Abschlussquote 40% · Abschlüsse 20% · Kontaktquote 25% · Effizienz 15%
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Score (0–100)
                </div>
                <div className="text-[11px] text-slate-500">Team-Schnitt: {avgScore.toFixed(1)} Pkt.</div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {top3.map(({ seller, score, rank, perf: p, team }) => {
                return (
                  <div
                    key={seller.id}
                    className={cn(
                      'relative rounded-2xl border p-4 bg-white transition hover:shadow-md',
                      rank === 1
                        ? 'border-amber-200 ring-2 ring-amber-200/60'
                        : rank === 2
                          ? 'border-slate-200'
                          : 'border-amber-900/20',
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={cn(
                          'inline-flex items-center justify-center h-8 w-8 rounded-lg border font-bold shadow-sm',
                          rankBadge(rank),
                        )}
                      >
                        {rankIcon(rank)}
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-slate-900 tabular-nums leading-none">
                          {score.toFixed(1)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-medium">
                          Punkte
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-[13px] font-semibold text-white">
                        {(seller.full_name ?? seller.email ?? '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {seller.full_name ?? seller.email}
                        </div>
                        {team && (
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            {team.color && (
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: team.color }}
                              />
                            )}
                            Team {team.name}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center border-t border-slate-100 pt-3">
                      <div>
                        <div className="text-sm font-bold text-emerald-700 tabular-nums">
                          {formatPercent(p.abschluss_quote ?? 0)}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">
                          Quote
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 tabular-nums">
                          {p.abschlüsse ?? 0}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">
                          Abschl.
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-700 tabular-nums">
                          {p.leads_total ?? 0}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">
                          Leads
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {scoredSellers.length > 3 && (
                <div className="sm:col-span-3 mt-1 pt-3 border-t border-dashed border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-xs text-slate-500">
                    Platz 4–{scoredSellers.length}: {scoredSellers.length - 3} weitere Verkäufer in der
                    Vergleichstabelle unten
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Score-Schnitt:</span>
                    <span className="font-bold tabular-nums text-slate-800">
                      {avgScore.toFixed(1)} Pkt.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
        <StatCard label="Leads" value={stats.leads} icon={<Users className="h-4 w-4" />} accent="default" />
        <StatCard label="Kontaktversuche" value={stats.kontaktversuche} icon={<Phone className="h-4 w-4" />} accent="default" />
        <StatCard label="Erreichte Kunden" value={stats.erreichte_kunden} icon={<PhoneCall className="h-4 w-4" />} accent="success" />
        <StatCard label="Rückrufe offen" value={stats.rueckrufe} icon={<PhoneForwarded className="h-4 w-4" />} accent="warning" />
        <StatCard label="Angebote" value={stats.angebote} icon={<FileSignature className="h-4 w-4" />} accent="default" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Abschlüsse" value={stats.abschlüsse} icon={<CheckCircle2 className="h-4 w-4" />} accent="success" />
        <StatCard label="Verlorene Leads" value={stats.verlorene_leads} icon={<XCircle className="h-4 w-4" />} accent="danger" />
        <StatCard
          label="Abschlussquote"
          value={formatPercent(stats.abschluss_quote)}
          icon={<Target className="h-4 w-4" />}
          accent={stats.abschluss_quote >= 0.3 ? 'success' : stats.abschluss_quote >= 0.1 ? 'warning' : 'danger'}
        />
        <StatCard
          label="Kontaktquote"
          value={formatPercent(stats.kontakt_quote)}
          icon={<Percent className="h-4 w-4" />}
          accent={stats.kontakt_quote >= 0.7 ? 'success' : stats.kontakt_quote >= 0.4 ? 'warning' : 'danger'}
        />
      </div>

      {/* #95 Lead-Funnel */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
            <Funnel className="h-4 w-4 text-slate-400" />
            Lead-Funnel
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Lead-Entwicklung über die 5 wichtigsten Conversion-Stufen
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <FunnelChartClient data={funnelData} />
        </CardContent>
      </Card>

      {/* #96 Kampagnen Performance */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            Kampagnen Performance
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Vergleich aller Kampagnen nach Leads, Zuweisungen und Abschlussquote
          </p>
        </CardHeader>
        <CardContent className="pt-0 p-0 overflow-hidden">
          <CampaignPerfTableClient campaigns={campaigns} />
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-slate-400" />
            Verkäufer-Vergleich
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Mit Score-Ranking, Team-Zuordnung und Detail-KPIs
          </p>
        </CardHeader>
        <CardContent className="pt-0 p-0 overflow-hidden">
          <Suspense fallback={<Skeleton className="h-64" />}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Verkäufer</TableHead>
                  <TableHead className="hidden md:table-cell">Team</TableHead>
                  <TableHead className="text-right tabular-nums">Score</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Abschlüsse</TableHead>
                  <TableHead className="text-right">Verloren</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Quote</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Ø Kontakte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scoredSellers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 bg-slate-50 px-6 py-10 rounded-lg m-4 text-center">
                        <Sparkles className="h-5 w-5 text-slate-400 mb-2" />
                        <div className="text-sm font-medium text-slate-800">Keine Verkäufer angelegt</div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  scoredSellers.map(({ seller, perf: p, score, rank, team }) => (
                    <TableRow key={seller.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className={cn(
                          'inline-flex items-center justify-center h-7 w-7 rounded-md border text-[10px] font-bold shadow-sm',
                          rankBadge(rank),
                        )}>
                          {rank <= 3 ? rankIcon(rank) : rank}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-[10px] font-semibold text-white">
                            {(seller.full_name ?? seller.email ?? '?').slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900">{seller.full_name ?? 'Kein Name'}</div>
                            <div className="text-[11px] text-slate-500">{seller.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {team ? (
                          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: team.color }}
                            />
                            {team.name}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">— kein Team —</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={cn(
                          'text-sm font-bold',
                          score >= 60
                            ? 'text-emerald-700'
                            : score >= 35
                              ? 'text-amber-700'
                              : 'text-slate-500',
                        )}>
                          {score.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{p.leads_total}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {p.abschlüsse}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-red-700">{p.verloren}</TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        <span className={
                          'text-sm font-medium ' +
                          (p.abschluss_quote >= 0.3
                            ? 'text-emerald-700'
                            : p.abschluss_quote >= 0.1
                              ? 'text-amber-700'
                              : 'text-slate-500')
                        }>
                          {formatPercent(p.abschluss_quote)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-sm text-slate-700 tabular-nums">
                        {p.durchschnitt_kontakte.toFixed(1).replace('.', ',')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
