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
import { Target, DollarSign, Users, Sparkles, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CampaignDialogs } from './CampaignDialogs'

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
        actions={<CampaignDialogs.Create campaigns={campaigns} />}
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

  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-900">{campaign.name}</span>
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
      <TableCell className="text-right tabular-nums text-sm">
        {campaign.budget_amount ? `${formatCurrency(campaign.budget_amount)} €` : '-'}
      </TableCell>
      <TableCell className="hidden md:table-cell text-xs text-slate-500">
        {formatDateShort(campaign.start_date)}
      </TableCell>
      <TableCell className="hidden md:table-cell text-xs text-slate-500">
        {formatDateShort(campaign.end_date)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm font-medium text-slate-900">
        {stats.total ?? 0}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm hidden sm:table-cell">
        {stats.assigned ?? 0}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm text-emerald-700 font-medium hidden lg:table-cell">
        {stats.closed ?? 0}
      </TableCell>
      <TableCell className="text-right text-xs text-slate-600 tabular-nums hidden lg:table-cell">
        {avgConsumption}
      </TableCell>
      <TableCell className="text-right hidden xl:table-cell">
        <span className={cn(
          'text-sm font-medium',
          stats.quote >= 0.2
            ? 'text-emerald-700'
            : stats.quote >= 0.1
              ? 'text-amber-700'
              : 'text-slate-500'
        )}>
          {formatPercent(stats.quote)}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <CampaignDialogs.Edit campaign={campaign} />
      </TableCell>
    </TableRow>
  )
}
