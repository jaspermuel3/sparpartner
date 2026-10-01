import Link from 'next/link'
import { requireSeller, getUserWallet } from '@/lib/auth'
import { getTokenTransactions } from '@/lib/services/tokens.service'
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
import { Coins, ArrowDownRight, ArrowUpRight, History, ArrowLeft } from 'lucide-react'
import { formatDate, TOKEN_TYPE_LABELS } from '@/lib/constants'
import type { TokenTransaction } from '@/types'

export const metadata = { title: 'Token-Historie' }

export default async function TokenHistoryPage() {
  const user = await requireSeller()
  const wallet = await getUserWallet(user.id)
  const transactions = (await getTokenTransactions(user.id, 100)) as TokenTransaction[]

  const balance = wallet?.balance ?? 0
  const totalEingebucht = transactions
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + (t.amount ?? 0), 0)
  const totalAusgebucht = transactions
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Token-Historie"
        description="Übersicht über alle deine Token-Buchungen."
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Token-Historie' },
        ]}
        actions={
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zum Dashboard
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Aktuelles Guthaben"
          value={balance}
          icon={<Coins className="h-4 w-4" />}
          accent={balance === 0 ? 'danger' : balance < 5 ? 'warning' : 'brand'}
        />
        <StatCard
          label="Eingebucht (gesamt)"
          value={totalEingebucht}
          icon={<ArrowDownRight className="h-4 w-4" />}
          accent="success"
        />
        <StatCard
          label="Ausgebucht (gesamt)"
          value={totalAusgebucht}
          icon={<ArrowUpRight className="h-4 w-4" />}
          accent="warning"
        />
      </div>

      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
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
                <TableHead>Typ</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
                <TableHead className="hidden sm:table-cell">Grund / Von</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-xs text-slate-500">
                      Noch keine Transaktionen vorhanden. Fordere deinen ersten Lead an, um loszulegen.
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {transactions.map((t: any) => (
                <TableRow key={t.id} className="hover:bg-slate-50">
                  <TableCell className="whitespace-nowrap text-xs text-slate-500">
                    {formatDate(t.created_at)}
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
                    {t.lead_id && (
                      <Link
                        href={`/leads/${t.lead_id}`}
                        className="ml-2 text-[10px] text-slate-400 hover:text-slate-600 hover:underline"
                      >
                        (Lead öffnen)
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        'text-sm font-semibold tabular-nums ' +
                        (t.amount >= 0 ? 'text-emerald-700' : 'text-red-700')
                      }
                    >
                      {t.amount >= 0 ? '+' : ''}
                      {Math.abs(t.amount ?? 0)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-slate-500">
                    {t.reason || '–'}
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
  )
}
