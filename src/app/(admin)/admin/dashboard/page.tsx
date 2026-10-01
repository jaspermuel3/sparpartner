import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import {
  getAdminDashboardStats,
  getLeadsPerDay,
  getClosedPerDay,
  getLeadStatusDistribution,
} from '@/lib/services/admin.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/ui-custom/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LeadStatusBadge } from '@/components/ui-custom/StatusBadges'
import {
  Sparkles,
  Users,
  CheckCircle2,
  Layers,
  UserCheck,
  CreditCard,
  Target,
  XCircle,
  BarChart3,
  PieChart,
  TrendingUp,
} from 'lucide-react'
import { LEAD_STATUS_LABELS, formatPercent } from '@/lib/constants'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = { title: 'Dashboard · Admin' }

export default async function AdminDashboardPage() {
  const user = await requireAdmin()
  const [stats, leadsPerDay, closedPerDay, statusDist] = await Promise.all([
    getAdminDashboardStats(),
    getLeadsPerDay(7),
    getClosedPerDay(7),
    getLeadStatusDistribution(),
  ])

  const statusEntries = Object.entries(statusDist).sort((a, b) => b[1] - a[1])
  const totalLeads = statusEntries.reduce((s, [, c]) => s + c, 0) || 1
  const palette: Record<string, string> = {
    new: '#64748b',
    assigned: '#3b82f6',
    contacted: '#f59e0b',
    callback: '#f97316',
    offer: '#6366f1',
    closed: '#10b981',
    no_interest: '#ef4444',
    wrong_data: '#ef4444',
    canceled: '#94a3b8',
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Gesamtübersicht über Leads, Verkäufer und Tokens."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/leads"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Leads verwalten
            </Link>
            <Link
              href="/admin/sellers"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
            >
              Verkäufer
            </Link>
          </div>
        }
      />

      <Suspense fallback={<GridSkeleton n={7} />}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <StatCard label="Neue Leads heute" value={stats.new_leads_today} icon={<Sparkles className="h-4 w-4" />} accent="brand" />
          <StatCard label="Verfügbare Leads" value={stats.available_leads} icon={<Layers className="h-4 w-4" />} accent="default" />
          <StatCard label="Vergebene Leads" value={stats.assigned_leads} icon={<UserCheck className="h-4 w-4" />} accent="default" />
          <StatCard label="Abgeschlossen" value={stats.closed_leads} icon={<CheckCircle2 className="h-4 w-4" />} accent="success" />
          <StatCard label="Verloren" value={stats.lost_leads} icon={<XCircle className="h-4 w-4" />} accent="danger" />
          <StatCard label="Aktive Verkäufer" value={stats.active_sellers} icon={<Users className="h-4 w-4" />} accent="default" />
          <StatCard label="Tokens verbraucht" value={stats.tokens_debit} icon={<CreditCard className="h-4 w-4" />} accent="warning" />
        </div>
      </Suspense>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="col-span-1 lg:col-span-2 border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-400" />
              Leads pro Tag (letzte 7 Tage)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <BarChart data={leadsPerDay} closed={closedPerDay} />
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
              <PieChart className="h-4 w-4 text-slate-400" />
              Status-Verteilung
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {statusEntries.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                Noch keine Leads im System.
              </div>
            )}
            {statusEntries.map(([status, count]) => {
              const pct = count / totalLeads
              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: palette[status] ?? '#94a3b8' }}
                      />
                      <LeadStatusBadge status={status as any} />
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-semibold text-slate-800">{count}</span>
                      <span className="text-[11px] text-slate-500">({formatPercent(pct)})</span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(pct * 100, 1)}%`,
                        background: palette[status] ?? '#94a3b8',
                      }}
                    />
                  </div>
                </div>
              )
            })}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Gesamt</span>
              <span className="font-medium text-slate-800">{totalLeads} Leads</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <Target className="h-3.5 w-3.5" />
                Abschlussquote
              </span>
              <span className="font-semibold text-emerald-800">{formatPercent(stats.abschluss_quote)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function BarChart({ data, closed }: { data: { date: string; count: number }[]; closed: { date: string; count: number }[] }) {
  const closedMap = new Map(closed.map((c) => [c.date, c.count]))
  const max = Math.max(1, ...data.map((d) => d.count), ...closed.map((c) => c.count))

  const labels: Record<string, string> = {
    /* localized via toLocaleDateString */
  }
  void labels

  return (
    <div className="pt-2">
      <div className="mb-2 flex items-center gap-4 text-[11px] text-slate-500">
        <Legend color="#3b82f6" label="Neue Leads" />
        <Legend color="#10b981" label="Abschlüsse" />
      </div>
      <div className="grid grid-cols-7 gap-3 h-48 items-end">
        {data.map((d) => {
          const closed = closedMap.get(d.date) ?? 0
          const h1 = (d.count / max) * 100
          const h2 = (closed / max) * 100
          return (
            <div key={d.date} className="flex h-full flex-col items-center justify-end gap-2">
              <div className="flex w-full items-end justify-center gap-1 h-[calc(100%-1.5rem)]">
                <div
                  className="w-1/2 rounded-t-md bg-blue-500 transition-all hover:bg-blue-600"
                  style={{ height: `${Math.max(h1, d.count > 0 ? 4 : 0)}%` }}
                  title={`${d.count} neue Leads`}
                />
                <div
                  className="w-1/2 rounded-t-md bg-emerald-500 transition-all hover:bg-emerald-600"
                  style={{ height: `${Math.max(h2, closed > 0 ? 4 : 0)}%` }}
                  title={`${closed} Abschlüsse`}
                />
              </div>
              <div className="text-[10px] text-slate-500 whitespace-nowrap">
                {new Date(d.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function GridSkeleton({ n }: { n: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-7 w-20 mb-1" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  )
}
