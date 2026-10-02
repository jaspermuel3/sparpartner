import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import {
  getLeadsPerDay,
  getLeadStatusDistribution,
  getDashboardStatsExtended,
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
  CalendarDays,
  Gauge,
} from 'lucide-react'
import { LEAD_STATUS_LABELS, formatPercent } from '@/lib/constants'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const LeadTrendChart = dynamic(() => import('@/components/ui-custom/LeadTrendChart').then((m) => m.LeadTrendChart), {
  ssr: false,
  loading: () => (
    <div className="h-64 flex items-center justify-center">
      <Skeleton className="h-full w-full rounded-md" />
    </div>
  ),
})

export const metadata = { title: 'Dashboard · Admin' }

const PERIOD_OPTIONS = [
  { label: '7 Tage', value: 7 },
  { label: '30 Tage', value: 30 },
  { label: '90 Tage', value: 90 },
]

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: { period?: string }
}) {
  const user = await requireAdmin()
  const period = Math.max(7, Math.min(90, Number(searchParams.period ?? 7) || 7))

  const [extended, leadsPerDay, statusDist] = await Promise.all([
    getDashboardStatsExtended(14),
    getLeadsPerDay(period),
    getLeadStatusDistribution(),
  ])

  const stats = extended.base
  const deltas = extended.deltas
  const sparks = extended.sparklines
  const capacity = extended.capacity

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

  const chartData = (leadsPerDay as any[]).map((r: any) => ({
    date: new Date(r.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
    'Neue Leads': r.count ?? 0,
    Abschlüsse: r.closed ?? 0,
  }))

  const capacityPulse = capacity.ratio >= 0.8

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Gesamtübersicht über Leads, Verkäufer und Tokens."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
              {PERIOD_OPTIONS.map((opt) => {
                const active = Number(period) === opt.value
                return (
                  <Link
                    key={opt.value}
                    href={`/admin/dashboard?period=${opt.value}`}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition',
                      active
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    <CalendarDays className="h-3 w-3" />
                    {opt.label}
                  </Link>
                )
              })}
            </div>
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

      <Suspense fallback={<GridSkeleton n={8} />}>
        <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Neue Leads heute"
            value={stats.new_leads_today}
            icon={<Sparkles className="h-4 w-4" />}
            accent="brand"
            trendValue={deltas.new_leads_today_pct}
            trendLabel="vs. gestern"
            href="/admin/leads"
            sparkline={sparks.map((s) => s.newLeads)}
          />
          <StatCard
            label="Verfügbare Leads"
            value={stats.available_leads}
            icon={<Layers className="h-4 w-4" />}
            accent="default"
            href="/admin/leads?availability=available"
          />
          <StatCard
            label="Vergebene Leads"
            value={stats.assigned_leads}
            icon={<UserCheck className="h-4 w-4" />}
            accent="default"
            href="/admin/leads?availability=assigned"
          />
          <StatCard
            label="Abgeschlossen"
            value={stats.closed_leads}
            icon={<CheckCircle2 className="h-4 w-4" />}
            accent="success"
            trendValue={deltas.closed_leads_today_pct}
            trendLabel="heute vs. gestern"
            href="/admin/leads?statuses=closed"
            sparkline={sparks.map((s) => s.closed)}
          />
          <StatCard
            label="Verloren"
            value={stats.lost_leads}
            icon={<XCircle className="h-4 w-4" />}
            accent="danger"
            href="/admin/leads?statuses=no_interest&statuses=wrong_data&statuses=canceled"
          />
          <StatCard
            label="Aktive Verkäufer"
            value={stats.active_sellers}
            icon={<Users className="h-4 w-4" />}
            accent="default"
            href="/admin/sellers"
          />
          <StatCard
            label="Tokens verbraucht"
            value={stats.tokens_debit}
            icon={<CreditCard className="h-4 w-4" />}
            accent="warning"
            trendValue={deltas.tokens_debit_today_pct}
            trendLabel="heute vs. gestern"
            href="/admin/tokens"
            sparkline={sparks.map((s) => s.tokensDebit)}
          />
          <CapacityCard capacity={capacity} pulse={capacityPulse} />
        </div>
      </Suspense>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="col-span-1 lg:col-span-2 border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-400" />
              Leads pro Tag (letzte {period} Tage)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <LeadTrendChart data={chartData} />
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
            <Link
              href="/admin/stats"
              className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs hover:bg-emerald-100/60 transition"
            >
              <span className="flex items-center gap-1.5 text-emerald-700">
                <Target className="h-3.5 w-3.5" />
                Abschlussquote
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold text-emerald-800">{formatPercent(stats.abschluss_quote)}</span>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-700" />
              </span>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function CapacityCard({
  capacity,
  pulse,
}: {
  capacity: { assigned: number; max: number; ratio: number; pct: number }
  pulse: boolean
}) {
  const strokeColor =
    capacity.ratio >= 0.8 ? '#d97706' : capacity.ratio >= 0.5 ? '#3b82f6' : '#10b981'
  const bgColor =
    capacity.ratio >= 0.8 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : capacity.ratio >= 0.5 ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200'

  const R = 18
  const C = 2 * Math.PI * R
  const offset = C * (1 - Math.min(1, capacity.ratio))

  return (
    <Card
      className={cn(
        'card-hoverable h-full border-slate-200 bg-white shadow-sm transition',
        pulse && 'ring-2 ring-amber-300/60',
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
              <Gauge className="h-3 w-3" />
              Auslastung
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <div>
                <div className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                  {capacity.pct}%
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {capacity.assigned} / {capacity.max}
                </div>
              </div>
              <div className={cn('shrink-0 -mb-0.5', pulse && 'animate-pulse')}>
                <svg width="60" height="60" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r={R} fill="none" stroke="#e2e8f0" strokeWidth="4" />
                  <circle
                    cx="24"
                    cy="24"
                    r={R}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={offset}
                    transform="rotate(-90 24 24)"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                  <text
                    x="24"
                    y="27"
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="700"
                    fill={strokeColor}
                  >
                    {capacity.pct}%
                  </text>
                </svg>
              </div>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              je 50 Leads / Verkäufer
            </div>
          </div>
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm',
              bgColor,
            )}
          >
            <Gauge className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function GridSkeleton({ n }: { n: number }) {
  return (
    <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-full min-h-[132px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-7 w-20 mb-1" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  )
}
