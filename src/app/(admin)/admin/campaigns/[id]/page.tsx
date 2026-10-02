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

  const [campaign, leads] = await Promise.all([
    getCampaignById(campaignId),
    getCampaignLeads(campaignId, {
      page,
      pageSize: PAGE_SIZE,
      sortBy,
      sortDir,
      statuses: statusFilter ? [statusFilter as any] : undefined,
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
