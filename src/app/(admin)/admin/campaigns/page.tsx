import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import {
  getCampaignsWithStats,
  updateCampaign,
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
import { SOURCE_LABELS, formatCurrency, formatDateShort, formatPercent } from '@/lib/constants'
import { Target, DollarSign, Users, Sparkles, Pencil, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CreateCampaignDialog, EditCampaignDialog } from './CampaignDialogs'

export const metadata = { title: 'Kampagnen · Admin' }

export default async function AdminCampaignsPage() {
  await requireAdmin()
  const campaigns = await getCampaignsWithStats()

  const activeCount = campaigns.filter((c) => c.is_active).length
  const totalBudget = campaigns.reduce((sum, c) => sum + (c.budget_amount ?? 0), 0)
  const totalLeads = campaigns.reduce((sum, c) => sum + (c.stats?.total ?? 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Kampagnen' },
        ]}
        title="Kampagnen verwalten"
        description="Quellen, Budgets, Zeiträume & Performance pro Kampagne im Überblick."
        actions={<CreateCampaignDialog campaigns={campaigns} />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Aktive Kampagnen"
          value={activeCount}
          icon={<Target className="h-4 w-4" />}
          accent="success"
        />
        <StatCard
          label="Gesamt-Budget"
          value={formatCurrency(totalBudget) + ' €'}
          icon={<DollarSign className="h-4 w-4" />}
          accent="default"
        />
        <StatCard
          label="Leads gesamt"
          value={totalLeads}
          icon={<Users className="h-4 w-4" />}
          accent="default"
        />
      </div>

      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-slate-400" />
            Kampagnen
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 p-0 overflow-hidden">
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 bg-slate-50 px-6 py-12 rounded-lg m-4 text-center">
              <Sparkles className="h-5 w-5 text-slate-400 mb-2" />
              <div className="text-sm font-medium text-slate-800">Keine Kampagnen angelegt</div>
              <div className="text-xs text-slate-500 mt-1">
                Erstelle deine erste Kampagne, um Budgets und Performance zu tracken.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Quelle</TableHead>
                    <TableHead>Aktiv</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="hidden md:table-cell">Start</TableHead>
                    <TableHead className="hidden md:table-cell">Ende</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Zugewiesen</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Abschlüsse</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Ø Verbrauch</TableHead>
                    <TableHead className="text-right hidden xl:table-cell">Quote</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => (
                    <CampaignRow key={c.id} campaign={c} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CampaignRow({ campaign }: { campaign: any }) {
  const stats = campaign.stats ?? {}
  const avgConsumption =
    stats.avgPower && stats.avgGas
      ? `${Math.round(stats.avgPower)} / ${Math.round(stats.avgGas)}`
      : stats.avgPower
        ? `${Math.round(stats.avgPower)} Strom`
        : stats.avgGas
          ? `${Math.round(stats.avgGas)} Gas`
          : '-'

  const budget = Number(campaign.budget_amount ?? 0) || 0
  const assignedCount = stats.assigned ?? 0
  const usedBudget = assignedCount * 1
  const total = stats.total ?? 0
  const closed = stats.closed ?? 0
  const budgetPct = budget > 0 ? Math.min(1, usedBudget / budget) : 0
  const quote = stats.quote ?? 0

  const COST_PER_ABSCHLUSS_TARGET = 50
  let roiStatus: 'good' | 'warn' | 'bad' | 'none' = 'none'
  let roiText = '-'
  let RoiIcon: any = null
  if (budget > 0 && closed > 0) {
    const cpa = budget / closed
    const ratio = COST_PER_ABSCHLUSS_TARGET / Math.max(1, cpa)
    if (ratio >= 1.3) { roiStatus = 'good'; roiText = `ROI +${Math.round((ratio - 1) * 100)}%`; RoiIcon = TrendingUp }
    else if (ratio >= 0.7) { roiStatus = 'warn'; roiText = `Ø ${cpa.toFixed(0)}€`; RoiIcon = Minus }
    else { roiStatus = 'bad'; roiText = `ROI ${Math.round((ratio - 1) * 100)}%`; RoiIcon = TrendingDown }
  } else if (budget === 0 && total === 0) {
    roiStatus = 'none'; roiText = '-'; RoiIcon = null
  } else if (total > 0 && closed === 0 && budget > 0) {
    roiStatus = 'warn'; roiText = `0 Abschl.`; RoiIcon = Minus
  }

  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-slate-900">{campaign.name}</span>
            {roiStatus !== 'none' && RoiIcon && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold shadow-sm',
                  roiStatus === 'good' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  roiStatus === 'warn' && 'bg-amber-50 text-amber-700 border-amber-200',
                  roiStatus === 'bad' && 'bg-red-50 text-red-700 border-red-200',
                )}
              >
                <RoiIcon className="h-2.5 w-2.5" />
                {roiText}
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500">ID {campaign.id.slice(0, 8)}</span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm text-slate-700">
          {campaign.source ? SOURCE_LABELS[campaign.source as keyof typeof SOURCE_LABELS] : '-'}
        </span>
      </TableCell>
      <TableCell>
        <span className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2 py-0.5',
          campaign.is_active
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-slate-100 text-slate-500 border border-slate-200'
        )}>
          <span className={cn(
            'h-1.5 w-1.5 rounded-full',
            campaign.is_active ? 'bg-emerald-500' : 'bg-slate-400'
          )} />
          {campaign.is_active ? 'Aktiv' : 'Inaktiv'}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end gap-1.5 min-w-[120px]">
          <span className="text-sm tabular-nums text-slate-900 font-medium">
            {campaign.budget_amount ? `${formatCurrency(budget)} €` : '-'}
          </span>
          {budget > 0 && (
            <div className="w-full max-w-[120px]">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    budgetPct >= 0.95 ? 'bg-red-500' : budgetPct >= 0.7 ? 'bg-amber-500' : 'bg-emerald-500',
                  )}
                  style={{ width: `${Math.max(budgetPct * 100, budgetPct > 0 ? 2 : 0)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 tabular-nums text-right">
                {usedBudget} / {budget} Tok · {formatPercent(budgetPct)}
              </div>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell text-xs text-slate-500">
        {formatDateShort(campaign.start_date)}
      </TableCell>
      <TableCell className="hidden md:table-cell text-xs text-slate-500">
        {formatDateShort(campaign.end_date)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm font-medium text-slate-900">
        {total}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm hidden sm:table-cell">
        {assignedCount}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm text-emerald-700 font-medium hidden lg:table-cell">
        {closed}
      </TableCell>
      <TableCell className="text-right text-xs text-slate-600 tabular-nums hidden lg:table-cell">
        {avgConsumption}
      </TableCell>
      <TableCell className="text-right hidden xl:table-cell">
        <span className={cn(
          'text-sm font-medium',
          quote >= 0.2
            ? 'text-emerald-700'
            : quote >= 0.1
              ? 'text-amber-700'
              : 'text-slate-500'
        )}>
          {formatPercent(quote)}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <EditCampaignDialog campaign={campaign} />
      </TableCell>
    </TableRow>
  )
}
