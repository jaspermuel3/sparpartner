import { requireAdmin } from '@/lib/auth'
import {
  getStatistics,
  getAllSellers,
  getSellerPerformance,
  getAdminDashboardStats,
  getLeadStatusDistribution,
  getCampaignsWithStats,
} from '@/lib/services/admin.service'
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
} from 'lucide-react'
import {
  formatPercent,
  SOURCE_LABELS,
  formatCurrency,
  formatDateShort,
} from '@/lib/constants'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
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
  const dashboard = await getAdminDashboardStats()
  const statusDist = await getLeadStatusDistribution()
  const campaigns = await getCampaignsWithStats()

  const totalLeads = Object.values(statusDist).reduce((sum, n) => sum + n, 0) || stats.leads

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
        </CardHeader>
        <CardContent className="pt-0 p-0 overflow-hidden">
          <Suspense fallback={<Skeleton className="h-64" />}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Verkäufer</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Abschlüsse</TableHead>
                  <TableHead className="text-right">Verloren</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Quote</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Ø Kontakte / Lead</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellers.map((s: any) => (
                  <SellerRowPerf key={s.id} seller={s} />
                ))}
                {sellers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 bg-slate-50 px-6 py-10 rounded-lg m-4 text-center">
                        <Sparkles className="h-5 w-5 text-slate-400 mb-2" />
                        <div className="text-sm font-medium text-slate-800">Keine Verkäufer angelegt</div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

async function SellerRowPerf({ seller }: { seller: any }) {
  const p = await getSellerPerformance(seller.id)
  return (
    <TableRow className="hover:bg-slate-50">
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
  )
}
