import { requireAdmin } from '@/lib/auth'
import { notFound } from 'next/navigation'
import {
  formatCurrency,
  formatDate,
  formatDateShort,
  formatPercent,
  formatPhone,
  phoneHref,
  SOURCE_LABELS,
  STATUS_COLORS,
  LEAD_STATUS_LABELS,
  formatRelative,
} from '@/lib/constants'
import {
  getCampaignById,
  getCampaignLeads,
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  EditCampaignDialog,
} from '../CampaignDialogs'
import {
  ArrowLeft,
  Target,
  DollarSign,
  Users,
  Sparkles,
  Phone,
  Mail,
  Pencil,
  TrendingUp,
  TrendingDown,
  Minus,
  UserCircle2,
  Zap,
  Boxes,
  Layers3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export const metadata = { title: 'Kampagne · Admin' }

const PAGE_SIZE = 50

type SearchParams = {
  page?: string
  sort?: string
  dir?: 'asc' | 'desc'
  status?: string
}

export default async function AdminCampaignDetailPage(props: {
  params: Promise<{ id: string }> | { id: string }
  searchParams: SearchParams
}) {
  await requireAdmin()

  const resolvedParams = (props.params as any)?.then
    ? await (props.params as Promise<{ id: string }>)
    : (props.params as { id: string })

  const campaignId = resolvedParams?.id
  if (!campaignId || typeof campaignId !== 'string' || campaignId.length < 5) {
    notFound()
  }

  const sp = props.searchParams
  const page = Math.max(1, Number(sp.page ?? '1') || 1)
  const sortBy = (['created_at', 'status', 'assigned_user_id', 'product'].includes(sp.sort ?? '')) ? (sp.sort as string) : 'created_at'
  const sortDir = sp.dir === 'asc' ? 'asc' : 'desc'
  const statusFilter = (sp.status && sp.status.trim() && sp.status !== 'all') ? sp.status.trim() : null

  const [campaign, leads, allCampaignLeadsRes] = await Promise.all([
    getCampaignById(campaignId),
    getCampaignLeads(campaignId, {
      page,
      pageSize: PAGE_SIZE,
      sortBy,
      sortDir,
      statuses: statusFilter ? [statusFilter as any] : undefined,
    }),
    getCampaignLeads(campaignId, {
      page: 1,
      pageSize: 1000,
      sortBy: 'created_at',
      sortDir: 'desc',
    }),
  ])

  if (!campaign) {
    notFound()
  }

  const stats = (campaign as any).stats ?? {}
  const total = Number(stats.total ?? 0)
  const assigned = Number(stats.assigned ?? 0)
  const offer = Number(stats.offer ?? 0)
  const closed = Number(stats.closed ?? 0)
  const quote = Number(stats.quote ?? 0)
  const budget = Number((campaign as any).budget_amount ?? 0) || 0

  const allLeadsForStats = (allCampaignLeadsRes.rows ?? []) as any[]

  function buildPerDayLast7(rows: any[]) {
    const out: Array<{ date: string; count: number; label: string }> = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const iso = d.toISOString().slice(0, 10)
      out.push({
        date: iso,
        count: 0,
        label: d.toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2),
      })
    }
    const index = new Map<string, number>()
    out.forEach((d, i) => index.set(d.date, i))
    for (const r of rows) {
      if (!r.created_at) continue
      const iso = new Date(r.created_at).toISOString().slice(0, 10)
      const i = index.get(iso)
      if (i === undefined) continue
      out[i].count++
    }
    return out
  }

  function buildTopZips(rows: any[], n = 6) {
    const counts = new Map<string, { city?: string; count: number }>()
    for (const r of rows) {
      const zip = String(r.zip ?? '').trim()
      if (!zip) continue
      const cur = counts.get(zip) ?? { city: r.city ?? undefined, count: 0 }
      cur.count++
      counts.set(zip, cur)
    }
    return Array.from(counts.entries())
      .map(([zip, v]) => ({ zip, city: v.city, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n)
  }

  function buildProductBreakdown(rows: any[]) {
    const out: Record<string, number> = { strom: 0, gas: 0, beides: 0, sonstiges: 0 }
    for (const r of rows) {
      const p = String(r.product ?? '')
      if (p === 'strom' || p === 'gas' || p === 'beides') out[p]++
      else out.sonstiges++
    }
    return out
  }

  function buildConsultationRate(rows: any[]) {
    if (rows.length === 0) return 0
    let yes = 0
    for (const r of rows) {
      if (r.wants_consultation === true || r.wants_consultation === 'true' || r.wants_consultation === 't' || r.wants_consultation === 'yes') yes++
    }
    return yes / rows.length
  }

  function buildAvgPotential(rows: any[]) {
    const nums: number[] = []
    for (const r of rows) {
      const s = Number(r.estimated_savings ?? 0) || Number(r.savings_potential ?? 0) || 0
      if (s > 0) nums.push(s)
    }
    if (nums.length === 0) return 0
    return nums.reduce((a, b) => a + b, 0) / nums.length
  }

  const perDay7 = buildPerDayLast7(allLeadsForStats)
  const topZips = buildTopZips(allLeadsForStats)
  const productBreakdown = buildProductBreakdown(allLeadsForStats)
  const consultationRate = buildConsultationRate(allLeadsForStats)
  const avgPotential = buildAvgPotential(allLeadsForStats)
  const allAssigned = allLeadsForStats.filter((r) => !!r.assigned_user_id).length
  const allClosed = allLeadsForStats.filter((r) => r.status === 'closed').length
  const allCanceled = allLeadsForStats.filter((r) => r.status === 'canceled').length

  const COST_PER_ABSCHLUSS_TARGET = 50
  let roiStatus: 'good' | 'warn' | 'bad' | 'none' = 'none'
  let roiText = '-'
  let RoiIcon: any = Minus
  if (budget > 0 && closed > 0) {
    const cpa = budget / closed
    const ratio = COST_PER_ABSCHLUSS_TARGET / Math.max(1, cpa)
    if (ratio >= 1.3) {
      roiStatus = 'good'
      roiText = `ROI +${Math.round((ratio - 1) * 100)}%`
      RoiIcon = TrendingUp
    } else if (ratio >= 0.7) {
      roiStatus = 'warn'
      roiText = `Ø ${cpa.toFixed(0)}€`
      RoiIcon = Minus
    } else {
      roiStatus = 'bad'
      roiText = `ROI ${Math.round((ratio - 1) * 100)}%`
      RoiIcon = TrendingDown
    }
  } else if (budget === 0 && total === 0) {
    roiStatus = 'none'
    roiText = '-'
  } else if (total > 0 && closed === 0 && budget > 0) {
    roiStatus = 'warn'
    roiText = `0 Abschl.`
  }

  const assignedPct = total > 0 ? assigned / total : 0
  const closedPct = total > 0 ? closed / total : 0

  const totalPages = Math.max(1, Math.ceil(leads.count / PAGE_SIZE))
  const totalPagesSafe = Number.isFinite(totalPages) ? totalPages : 1

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Kampagnen', href: '/admin/campaigns' },
          { label: (campaign as any).name?.slice(0, 32) || 'Kampagne' },
        ]}
        title={`${(campaign as any).name ?? 'Kampagne'}`}
        description={`${(campaign as any).source ? SOURCE_LABELS[(campaign as any).source as keyof typeof SOURCE_LABELS] ?? (campaign as any).source : 'Ohne Quelle'} · ID ${campaignId.slice(0, 8)}…`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/campaigns">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Zurück
              </Link>
            </Button>
            <EditCampaignDialog campaign={campaign} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Leads gesamt"
          value={total}
          icon={<Users className="h-4 w-4" />}
          accent="default"
          hint={
            total > 0
              ? `${assigned} zugeordnet · ${formatPercent(assignedPct)}`
              : 'Keine Leads bisher'
          }
        />
        <StatCard
          label="Abschlüsse"
          value={closed}
          icon={<Sparkles className="h-4 w-4" />}
          accent="success"
          hint={
            total > 0
              ? `Quote ${formatPercent(quote)} · ${offer} in Angebot`
              : 'Quote —'
          }
        />
        <StatCard
          label="Budget"
          value={budget ? `${formatCurrency(budget)} €` : '—'}
          icon={<DollarSign className="h-4 w-4" />}
          accent={roiStatus === 'bad' ? 'danger' : roiStatus === 'warn' ? 'warning' : 'default'}
          trendLabel={
            roiStatus !== 'none'
              ? roiText
              : undefined
          }
          trendValue={
            roiStatus === 'good'
              ? 10
              : roiStatus === 'bad'
                ? -10
                : undefined
          }
        />
        <StatCard
          label="Ø Verbrauch"
          value={
            stats.avgPower && stats.avgGas
              ? `${Math.round(stats.avgPower)} / ${Math.round(stats.avgGas)}`
              : stats.avgPower
                ? `${Math.round(stats.avgPower)} Strom`
                : stats.avgGas
                  ? `${Math.round(stats.avgGas)} Gas`
                  : '—'
          }
          icon={<Zap className="h-4 w-4" />}
          accent="default"
          hint={
            (campaign as any).start_date || (campaign as any).end_date
              ? `${formatDateShort((campaign as any).start_date)} → ${formatDateShort((campaign as any).end_date)}`
              : 'Kein Laufzeitdatum'
          }
        />
      </div>

      <CampaignStatsSection
        perDay7={perDay7}
        topZips={topZips}
        productBreakdown={productBreakdown}
        consultationRate={consultationRate}
        avgPotential={avgPotential}
        allAssigned={allAssigned}
        allClosed={allClosed}
        allCanceled={allCanceled}
        allTotal={allLeadsForStats.length}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
              <Target className="h-4 w-4 text-slate-400" />
              Kampagnen-Infos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="inline-flex items-center gap-1">
                <Boxes className="h-3 w-3" />
                Quelle: {(campaign as any).source ? SOURCE_LABELS[(campaign as any).source as keyof typeof SOURCE_LABELS] ?? String((campaign as any).source) : 'Unbekannt'}
              </Badge>
              {!!(campaign as any).external_id && (
                <Badge variant="outline" className="text-slate-600">
                  External-ID · {String((campaign as any).external_id).slice(0, 16)}
                  {String((campaign as any).external_id).length > 16 ? '…' : ''}
                </Badge>
              )}
              <Badge variant="secondary" className={(campaign as any).is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}>
                {(campaign as any).is_active ? 'Aktiv' : 'Inaktiv'}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 text-xs text-slate-500">
              <div className="flex justify-between border-b border-slate-100 py-1.5">
                <span>Erstellt</span>
                <span className="tabular-nums text-slate-700">
                  {formatDate((campaign as any).created_at)}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1.5">
                <span>Startdatum</span>
                <span className="tabular-nums text-slate-700">
                  {formatDateShort((campaign as any).start_date) || '-'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1.5">
                <span>Enddatum</span>
                <span className="tabular-nums text-slate-700">
                  {formatDateShort((campaign as any).end_date) || '-'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span>Letzte Änderung</span>
                <span className="tabular-nums text-slate-700">
                  {formatDateShort((campaign as any).updated_at) || '-'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end pt-2">
              <EditCampaignDialog campaign={campaign}>
                <Button size="sm" variant="outline">
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Bearbeiten
                </Button>
              </EditCampaignDialog>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm overflow-hidden lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <UserCircle2 className="h-4 w-4 text-slate-400" />
                Leads dieser Kampagne
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {leads.count} · Seite {page}/{totalPagesSafe}
                </span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 p-0 overflow-hidden">
            {leads.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 bg-slate-50 px-6 py-12 rounded-lg m-4 text-center">
                <UserCircle2 className="h-6 w-6 text-slate-400 mb-2" />
                <div className="text-sm font-medium text-slate-800">Keine Leads in dieser Kampagne</div>
                <div className="text-xs text-slate-500 mt-1">
                  Sobald Leads via Meta Ads oder Landing Page zugeordnet werden, tauchen sie hier auf.
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead</TableHead>
                        <TableHead className="hidden sm:table-cell">Status</TableHead>
                        <TableHead>Produkt</TableHead>
                        <TableHead className="hidden lg:table-cell">Kontakt</TableHead>
                        <TableHead className="hidden md:table-cell">Verkäufer</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Eingang</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.rows.map((lead: any) => (
                        <TableRow key={lead.id} className="hover:bg-slate-50 group">
                          <TableCell>
                            <Link href={`/leads/${lead.id}`} className="flex flex-col group-hover:text-emerald-700">
                              <span className="text-sm font-medium text-slate-900">
                                {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unbekannt'}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {lead.zip ? `${lead.zip}` : ''}
                                {lead.city ? ` · ${lead.city}` : ''}
                                {' '}· ID {String(lead.id).slice(0, 6)}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className={cn(
                              'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold shadow-sm',
                              STATUS_COLORS[lead.status as keyof typeof STATUS_COLORS]?.bg ?? 'bg-slate-50',
                              STATUS_COLORS[lead.status as keyof typeof STATUS_COLORS]?.text ?? 'text-slate-700',
                            )}>
                              <span className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                STATUS_COLORS[lead.status as keyof typeof STATUS_COLORS]?.dot ?? 'bg-slate-400',
                              )} />
                              {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] ?? lead.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-700">
                              {lead.product === 'strom' ? 'Strom' : lead.product === 'gas' ? 'Gas' : lead.product === 'beides' ? 'Beides' : String(lead.product ?? '—')}
                            </span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-center gap-2">
                              {lead.phone ? (
                                <a
                                  href={phoneHref(String(lead.phone))}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  <Phone className="h-3 w-3" />
                                  {formatPhone(String(lead.phone))}
                                </a>
                              ) : null}
                              {lead.email ? (
                                <a
                                  href={`mailto:${String(lead.email)}`}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  <Mail className="h-3 w-3" />
                                  Mail
                                </a>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {lead.assigned_user?.full_name ? (
                              <div className="flex flex-col">
                                <span className="text-xs text-slate-800 font-medium">
                                  {String(lead.assigned_user.full_name)}
                                </span>
                                {lead.assigned_user?.email && (
                                  <span className="text-[10px] text-slate-500">
                                    {String(lead.assigned_user.email).slice(0, 24)}
                                    {String(lead.assigned_user.email).length > 24 ? '…' : ''}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">Offen · Pool</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right hidden sm:table-cell">
                            <div className="flex flex-col items-end">
                              <span className="text-xs tabular-nums text-slate-700">
                                {formatRelative(lead.created_at)}
                              </span>
                              <span className="text-[10px] text-slate-400 tabular-nums">
                                {formatDateShort(lead.created_at)}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {totalPagesSafe > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
                    <div className="text-xs text-slate-500">
                      Seite <span className="tabular-nums text-slate-700">{page}</span> / {totalPagesSafe} · {leads.count} Treffer
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page <= 1}
                        asChild={page > 1}
                      >
                        {page > 1 ? (
                          <Link href={`?page=${page - 1}${statusFilter ? `&status=${statusFilter}` : ''}`}>
                            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Zurück
                          </Link>
                        ) : (
                          <span className="inline-flex items-center">
                            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Zurück
                          </span>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page >= totalPagesSafe}
                        asChild={page < totalPagesSafe}
                      >
                        {page < totalPagesSafe ? (
                          <Link href={`?page=${page + 1}${statusFilter ? `&status=${statusFilter}` : ''}`}>
                            Weiter <TrendingUp className="h-3.5 w-3.5 ml-1 rotate-90" />
                          </Link>
                        ) : (
                          <span className="inline-flex items-center">
                            Weiter <TrendingUp className="h-3.5 w-3.5 ml-1 rotate-90" />
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function CampaignStatsSection({
  perDay7,
  topZips,
  productBreakdown,
  consultationRate,
  avgPotential,
  allAssigned,
  allClosed,
  allCanceled,
  allTotal,
}: {
  perDay7: Array<{ date: string; count: number; label: string }>
  topZips: Array<{ zip: string; city?: string; count: number }>
  productBreakdown: Record<string, number>
  consultationRate: number
  avgPotential: number
  allAssigned: number
  allClosed: number
  allCanceled: number
  allTotal: number
}) {
  const spark = perDay7
  const sparkMax = Math.max(1, ...spark.map((x) => x.count))
  const sparkSum = spark.reduce((a, b) => a + b.count, 0)
  const sparkLast = spark[spark.length - 1]?.count ?? 0
  const sparkPrev = spark[spark.length - 2]?.count ?? 0
  const sparkDelta = sparkPrev === 0 ? (sparkLast > 0 ? 100 : 0) : ((sparkLast - sparkPrev) / sparkPrev) * 100

  function Sparkline({ data, max }: { data: Array<{ count: number }>; max: number }) {
    const W = 120
    const H = 28
    const pts = data.map((d, i) => {
      const x = (i / Math.max(1, data.length - 1)) * W
      const y = H - (Math.max(0, d.count) / max) * (H - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-[120px] h-7 shrink-0">
        <defs>
          <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          fill="url(#sparkFill)"
          points={`0,${H} ${pts.join(' ')} ${W},${H}`}
          className="text-emerald-500"
        />
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={pts.join(' ')}
          className="text-emerald-600"
        />
      </svg>
    )
  }

  function BarsChart({ data }: { data: Array<{ date: string; count: number; label: string }> }) {
    const max = Math.max(1, ...data.map((d) => d.count))
    return (
      <div className="space-y-2">
        <div className="flex items-end gap-2 h-32">
          {data.map((d) => {
            const h = (d.count / max) * 100
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="w-full flex items-end justify-center h-full">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-emerald-500 to-emerald-400 border border-emerald-600/20 min-h-[4px] transition-[height] duration-300"
                    style={{ height: `${Math.max(4, h)}%` }}
                  />
                </div>
                <div className="flex flex-col items-center leading-none">
                  <div className="text-[10px] font-semibold tabular-nums text-slate-700">{d.count}</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">{d.label}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function MiniCard({
    label,
    value,
    hint,
    accent,
  }: {
    label: string
    value: React.ReactNode
    hint?: React.ReactNode
    accent?: 'default' | 'success' | 'warning' | 'danger'
  }) {
    const accentBg: Record<string, string> = {
      default: 'bg-slate-50 text-slate-600 border-slate-200',
      success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      warning: 'bg-amber-50 text-amber-700 border-amber-200',
      danger: 'bg-red-50 text-red-700 border-red-200',
    }
    return (
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="text-2xl font-semibold tracking-tight text-slate-900 leading-none">
            {value}
          </div>
          <span className={cn('inline-flex min-h-5 items-center rounded-md px-1.5 text-[10px] font-semibold border', accentBg[accent ?? 'default'])}>
            {hint ?? '—'}
          </span>
        </div>
      </div>
    )
  }

  const cancelRate = allTotal > 0 ? allCanceled / allTotal : 0

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Kampagnen-Statistiken
              <span className="ml-2 text-xs font-normal text-slate-500">
                letzte 7 Tage · {sparkSum} Leads
                {sparkDelta !== 0 && (
                  <span
                    className={cn(
                      'ml-2 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold border',
                      sparkDelta > 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-200',
                    )}
                  >
                    {sparkDelta > 0 ? '+' : ''}
                    {Math.round(sparkDelta)}%
                  </span>
                )}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MiniCard
                label="Leads 7 Tage"
                value={sparkSum}
                hint={sparkDelta === 0 ? 'Ø' : sparkDelta > 0 ? `↑ ${Math.round(sparkDelta)}%` : `↓ ${Math.round(Math.abs(sparkDelta))}%`}
                accent={sparkDelta >= 0 ? 'success' : 'danger'}
              />
              <MiniCard
                label="Beratungsrate"
                value={formatPercent(consultationRate)}
                hint={consultationRate >= 0.9 ? 'Sehr gut' : consultationRate >= 0.7 ? 'OK' : 'Niedrig'}
                accent={consultationRate >= 0.9 ? 'success' : consultationRate >= 0.7 ? 'default' : 'warning'}
              />
              <MiniCard
                label="Ø Sparpotenzial"
                value={avgPotential > 0 ? `${formatCurrency(avgPotential)} €` : '—'}
                hint={avgPotential >= 400 ? 'Hohe Ersparnis' : avgPotential >= 200 ? 'Solide' : 'Niedrig'}
                accent={avgPotential >= 400 ? 'success' : avgPotential >= 200 ? 'default' : 'warning'}
              />
              <MiniCard
                label="Abbruchrate"
                value={formatPercent(cancelRate)}
                hint={cancelRate <= 0.05 ? 'Niedrig' : cancelRate <= 0.15 ? 'OK' : 'Hoch'}
                accent={cancelRate <= 0.05 ? 'success' : cancelRate <= 0.15 ? 'default' : 'danger'}
              />
            </div>

            <div className="pt-2">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-700">Neue Leads pro Tag (letzte 7 Tage)</div>
                <div className="text-[10px] text-slate-400">Inkl. Wochentag</div>
              </div>
              <BarsChart data={perDay7} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-slate-400" />
              Top PLZ-Regionen
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {topZips.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-5 text-center text-xs text-slate-500">
                Noch keine PLZ-Daten vorhanden
              </div>
            ) : (
              topZips.map((z, i) => {
                const pct = allTotal > 0 ? (z.count / allTotal) * 100 : 0
                const topMax = topZips[0].count
                return (
                  <div key={z.zip} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-[10px] font-semibold text-slate-600 tabular-nums">
                          {i + 1}
                        </span>
                        <span className="font-semibold text-slate-900 tabular-nums">{z.zip}</span>
                        {z.city ? <span className="text-slate-500">· {z.city}</span> : null}
                      </div>
                      <span className="tabular-nums font-semibold text-slate-700">
                        {z.count}
                        <span className="ml-1 font-normal text-slate-400">({Math.round(pct)}%)</span>
                      </span>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                        style={{ width: `${Math.max(6, (z.count / Math.max(1, topMax)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
              <Boxes className="h-4 w-4 text-slate-400" />
              Produkt-Verteilung
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5">
            {(['strom', 'gas', 'beides', 'sonstiges'] as const).map((k) => {
              const c = productBreakdown[k] ?? 0
              const pct = allTotal > 0 ? (c / allTotal) * 100 : 0
              if (k === 'sonstiges' && c === 0) return null
              const accentMap: Record<string, { bar: string; pill: string }> = {
                strom: { bar: 'from-amber-500 to-amber-400', pill: 'bg-amber-50 text-amber-700 border-amber-200' },
                gas: { bar: 'from-sky-500 to-sky-400', pill: 'bg-sky-50 text-sky-700 border-sky-200' },
                beides: { bar: 'from-violet-500 to-violet-400', pill: 'bg-violet-50 text-violet-700 border-violet-200' },
                sonstiges: { bar: 'from-slate-500 to-slate-400', pill: 'bg-slate-50 text-slate-700 border-slate-200' },
              }
              const labels: Record<string, string> = { strom: 'Strom', gas: 'Gas', beides: 'Beides', sonstiges: 'Sonstige' }
              return (
                <div key={k} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={cn('inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-semibold', accentMap[k].pill)}>
                        {labels[k]}
                      </span>
                    </div>
                    <span className="tabular-nums font-semibold text-slate-700">
                      {c}
                      <span className="ml-1 font-normal text-slate-400">({Math.round(pct)}%)</span>
                    </span>
                  </div>
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn('absolute left-0 top-0 h-full rounded-full bg-gradient-to-r', accentMap[k].bar)}
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              )
            })}
            <div className="mt-2 grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 pt-3 mt-3">
              <div className="px-1 text-center">
                <div className="text-[11px] uppercase tracking-wider text-slate-400">Zugeordnet</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{allAssigned}</div>
              </div>
              <div className="px-1 text-center">
                <div className="text-[11px] uppercase tracking-wider text-slate-400">Abgeschlossen</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-700">{allClosed}</div>
              </div>
              <div className="px-1 text-center">
                <div className="text-[11px] uppercase tracking-wider text-slate-400">Abgebrochen</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums text-red-700">{allCanceled}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
