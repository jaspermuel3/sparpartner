import { requireAdmin } from '@/lib/auth'
import { getAllWalletsWithUser, getAllTransactions } from '@/lib/services/tokens.service'
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
import { Coins, CreditCard, ArrowDownRight, ArrowUpRight, Users, History } from 'lucide-react'
import { formatDate, TOKEN_TYPE_LABELS } from '@/lib/constants'

export const metadata = { title: 'Tokens · Admin' }

export default async function AdminTokensPage() {
  await requireAdmin()
  const wallets = await getAllWalletsWithUser()
  const txs = await getAllTransactions(500)

  const totalGuthaben = wallets.reduce((sum, w: any) => sum + (w.balance ?? 0), 0)
  const aktive = wallets.filter((w: any) => w.user?.is_active).length
  const debitSum = (txs as any[]).filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount ?? 0), 0)
  const creditSum = (txs as any[]).filter((t) => t.amount > 0).reduce((s, t) => s + (t.amount ?? 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Token-Verwaltung" description="Wallets, Guthaben und sämtliche Token-Transaktionen." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Aktive Wallets" value={aktive} icon={<Users className="h-4 w-4" />} accent="default" />
        <StatCard label="Guthaben gesamt" value={totalGuthaben} icon={<Coins className="h-4 w-4" />} accent="brand" />
        <StatCard label="Eingebucht (total)" value={creditSum} icon={<ArrowDownRight className="h-4 w-4" />} accent="success" />
        <StatCard label="Ausgebucht (total)" value={debitSum} icon={<ArrowUpRight className="h-4 w-4" />} accent="warning" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="border-slate-200 bg-white shadow-sm lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-slate-400" />
              Wallets
            </CardTitle>
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
                {wallets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2}>
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-xs text-slate-500">
                        Noch keine Wallets vorhanden.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {(wallets as any[]).map((w) => (
                  <TableRow key={w.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-[10px] font-semibold text-white">
                          {(w.user?.full_name ?? w.user?.email ?? '?').slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">{w.user?.full_name ?? 'Kein Name'}</div>
                          <div className="text-[11px] text-slate-500">{w.user?.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={
                        'inline-flex items-center gap-1 text-sm font-medium rounded-full px-2.5 py-0.5 ' +
                        (w.balance === 0
                          ? 'bg-red-50 text-red-700 border border-red-100'
                          : w.balance < 10
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
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
                {txs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-xs text-slate-500">
                        Noch keine Transaktionen.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {(txs as any[]).map((t) => (
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
