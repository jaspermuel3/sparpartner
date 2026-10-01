import { requireSeller } from '@/lib/auth'
import { getStatistics } from '@/lib/services/admin.service'
import { getContactTimeHeatmap } from '@/lib/services/leads.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/ui-custom/StatCard'
import { TargetProgressBar } from '@/components/ui-custom/TargetProgressBar'
import { HeatmapGrid } from '@/components/ui-custom/HeatmapGrid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
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
  TrendingUp,
  Clock3,
  LayoutDashboard,
} from 'lucide-react'
import { formatPercent } from '@/lib/constants'
import type { TimeHeatmapCell } from '@/types'

export const metadata = { title: 'Statistiken' }

export default async function StatsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string }
}) {
  const user = await requireSeller()
  const stats = await getStatistics(user.id, searchParams.from, searchParams.to)

  let heatmapData: TimeHeatmapCell[] = []
  try {
    heatmapData = await getContactTimeHeatmap(user.id, 56)
  } catch {
    heatmapData = []
  }

  const breadcrumb = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Statistiken' },
  ]

  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const msPerDay = 86_400_000
  const daysSinceMonthStart = Math.max(1, Math.floor((today.getTime() - firstOfMonth.getTime()) / msPerDay) + 1)
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()

  const kontakteProTag = stats.kontaktversuche / daysSinceMonthStart
  const abschluesseProMonat = stats.abschlüsse
  const kontaktQuotePct = stats.kontakt_quote * 100

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statistiken"
        description="Deine persönlichen Kennzahlen – nur eigene Leads & Aktivitäten."
        breadcrumb={breadcrumb}
      />

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

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="inline-flex items-center gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Übersicht
          </TabsTrigger>
          <TabsTrigger value="goals" className="inline-flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Ziele & Zeiten
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-slate-400" />
                Durchschnittliche Kontaktversuche
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <div>
                  <div className="text-3xl font-semibold tracking-tight text-slate-900">
                    {stats.durchschnitt_kontakte_pro_lead.toFixed(1).replace('.', ',')}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Ø Kontaktversuche pro kontaktiertem Lead</div>
                </div>
                <div className="h-14 w-24 rounded-lg bg-gradient-to-br from-slate-900 to-slate-600 text-white flex items-center justify-center">
                  <Target className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="mt-4 space-y-4">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
                <Target className="h-4 w-4 text-slate-400" />
                Deine Ziele
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <TargetProgressBar
                label="Kontakte pro Tag"
                current={kontakteProTag}
                target={10}
                type="leads"
              />
              <TargetProgressBar
                label="Abschlüsse diesen Monat"
                current={abschluesseProMonat}
                target={3}
                type="abschluesse"
              />
              <TargetProgressBar
                label="Kontaktquote"
                current={kontaktQuotePct}
                target={70}
                type="kontaktquote"
              />
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-slate-400" />
                Beste Kontaktzeiten
                <span className="ml-auto text-[11px] font-normal text-slate-500">
                  letzten 8 Wochen
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <HeatmapGrid
                data={heatmapData.length > 0 ? heatmapData : undefined}
                userId={user.id}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
