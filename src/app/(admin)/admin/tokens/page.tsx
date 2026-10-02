import { requireAdmin } from '@/lib/auth'
import { getAllWalletsWithUser, getAllTransactions } from '@/lib/services/tokens.service'
import {
  getTokenBurnRate,
  getSellerActivityStatuses,
  getCancellationRequests,
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
  Coins,
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  Users,
  History,
  Activity,
  Flame,
  AlertTriangle,
  Ban,
  CheckCircle2,
  XCircle,
  FileX2,
} from 'lucide-react'
import {
  formatDate,
  formatDateShort,
  TOKEN_TYPE_LABELS,
  SOURCE_LABELS,
  PRODUCT_LABELS,
} from '@/lib/constants'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'
import { CancellationPanelClient } from './CancellationPanel'

const TokenBurnChart = dynamic(
  () => import('./TokenBurnChart').then((m) => m.TokenBurnChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full rounded" />,
  },
)

export const metadata = { title: 'Tokens · Admin' }

export default async function AdminTokensPage() {
  await requireAdmin()
  const [wallets, txs, burn, activitySet, allCancels] = await Promise.all([
    getAllWalletsWithUser(),
    getAllTransactions(500),
    getTokenBurnRate(30),
    getSellerActivityStatuses(),
    getCancellationRequests('all'),
  ])

  const pendingCancels = allCancels.filter((r: any) => r.status === 'pending')

  const totalGuthaben = wallets.reduce((sum, w: any) => sum + (w.balance ?? 0), 0)
  const aktive = wallets.filter((w: any) => w.user?.is_active).length
  const txsArr = txs as any[]
  const debitSum = txsArr.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount ?? 0), 0)
  const creditSum = txsArr.filter((t) => t.amount > 0).reduce((s, t) => s + (t.amount ?? 0), 0)

  const lowBalanceWallets = wallets.filter(
    (w: any) => w.user?.is_active && (w.balance ?? 0) < 5,
  ) as any[]

  const walletsWithStatus = (wallets as any[]).map((w) => ({
    ...w,
    online: activitySet.has(w.user_id),
  }))

  const burnChartData = burn.series.map((s) => ({
    date: new Date(s.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
    Verbrauch: s.value,
    'Ø 7 Tage': s.ma,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Token-Verwaltung"
        description="Wallets, Guthaben, Verbrauch und Lead-Stornierungsanfragen."
      />

      {lowBalanceWallets.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-100 text-amber-700 shadow-sm">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                {lowBalanceWallets.length} Wallet{lowBalanceWallets.length === 1 ? '' : 's'} mit niedrigem Guthaben
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                Folgende Verkäufer haben weniger als 5 Tokens. Diese können keine neuen Leads mehr anfordern.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {lowBalanceWallets.map((w) => (
                  <div
                    key={w.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white/70 px-2.5 py-1 text-xs shadow-sm"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">
                      {(w.user?.full_name ?? w.user?.email ?? '?').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="font-medium text-amber-900 truncate max-w-[140px]">
                      {w.user?.full_name ?? w.user?.email}
                    </span>
                    <span className="tabular-nums font-bold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 border border-amber-200">
                      {w.balance ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Aktive Wallets" value={aktive} icon={<Users className="h-4 w-4" />} accent="default" />
        <StatCard label="Guthaben gesamt" value={totalGuthaben} icon={<Coins className="h-4 w-4" />} accent="brand" />
        <StatCard label="Eingebucht (total)" value={creditSum} icon={<ArrowDownRight className="h-4 w-4" />} accent="success" />
        <StatCard label="Ausgebucht (total)" value={debitSum} icon={<ArrowUpRight className="h-4 w-4" />} accent="warning" />
        <StatCard
          label="Ausstehende Stornos"
          value={pendingCancels.length}
          icon={<FileX2 className="h-4 w-4" />}
          accent={pendingCancels.length > 0 ? 'danger' : 'default'}
          hint={
            pendingCancels.length > 0
              ? 'bearbeiten →'
              : 'aktuell keine'
          }
        />
      </div>

      <CancellationPanelClient initialRequests={allCancels} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 bg-white shadow-sm lg:col-span-3 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Token-Burn-Rate · letzte 30 Tage
            </CardTitle>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
              <span className="inline-flex items-center gap-1">
                <Coins className="h-3 w-3 text-slate-400" />
                Gesamt: <span className="font-semibold tabular-nums text-slate-800">{burn.totalBurn}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Activity className="h-3 w-3 text-slate-400" />
                Ø pro Tag: <span className="font-semibold tabular-nums text-slate-800">{burn.avgDaily}</span>
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <TokenBurnChart data={burnChartData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="border-slate-200 bg-white shadow-sm lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-slate-400" />
              Wallets
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              Grün = Aktiv in den letzten 2 Std.
            </p>
          </CardHeader>
          <CardContent className="pt-0 p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Verkäufer</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {walletsWithStatus.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2}>
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-xs text-slate-500">
                        Noch keine Wallets vorhanden.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {walletsWithStatus.map((w) => (
                  <TableRow key={w.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-[10px] font-semibold text-white">
                            {(w.user?.full_name ?? w.user?.email ?? '?').slice(0, 1).toUpperCase()}
                          </div>
                          <span
                            className={cn(
                              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm',
                              w.online ? 'bg-emerald-500' : 'bg-slate-300',
                            )}
                            title={w.online ? 'aktiv (letzte 2 Std.)' : 'inaktiv'}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <div className="text-sm font-medium text-slate-900">
                              {w.user?.full_name ?? 'Kein Name'}
                            </div>
                            {w.online && (
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">
                                Online
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">{w.user?.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={
                        'inline-flex items-center gap-1 text-sm font-medium rounded-full px-2.5 py-0.5 ' +
                        (w.balance === 0
                          ? 'bg-red-50 text-red-700 border border-red-100'
                          : w.balance < 5
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : w.balance < 10
                              ? 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-100')
                      }>
                        <Coins className="h-3.5 w-3.5" /> {w.balance ?? 0}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm lg:col-span-3 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
              <History className="h-4 w-4 text-slate-400" />
              Transaktionen
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 p-0 max-h-[70vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Verkäufer</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead className="hidden md:table-cell">Grund / Von</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txsArr.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-xs text-slate-500">
                        Noch keine Transaktionen.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {txsArr.map((t) => (
                  <TableRow key={t.id} className="hover:bg-slate-50">
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">{formatDate(t.created_at)}</TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-800">{t.user?.full_name ?? t.user?.email ?? '-'}</div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                        {t.amount >= 0 ? (
                          <ArrowDownRight className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />
                        )}
                        {TOKEN_TYPE_LABELS[(t.type ?? '') as keyof typeof TOKEN_TYPE_LABELS] ?? t.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={
                        'text-sm font-semibold tabular-nums ' +
                        (t.amount >= 0 ? 'text-emerald-700' : 'text-red-700')
                      }>
                        {t.amount >= 0 ? '+' : ''}
                        {Math.abs(t.amount ?? 0)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-slate-500">
                      {t.reason}
                      {t.created_by_user?.full_name && (
                        <span className="text-slate-400"> · {t.created_by_user.full_name}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
