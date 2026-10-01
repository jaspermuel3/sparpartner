'use client'

import {
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { SOURCE_LABELS, formatPercent, formatCurrency, formatDateShort } from '@/lib/constants'

const COLORS = ['#0f172a', '#1d4ed8', '#0ea5e9', '#6366f1', '#10b981']

export function FunnelChartClient({ data }: { data: any[] }) {
  const total = data[0]?.value ?? 1

  return (
    <div className="w-full" style={{ height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart>
          <Tooltip
            cursor={{ fill: 'rgba(15, 23, 42, 0.05)' }}
            content={({ active, payload }) => {
              if (active && payload?.[0]) {
                const row = payload[0].payload as any
                const pct = total > 0 ? ((row.value / total) * 100).toFixed(1) : '0'
                const drop = total > 0 ? (100 - (row.value / total) * 100).toFixed(1) : '0'
                return (
                  <div className="rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2 text-xs space-y-1">
                    <div className="font-medium text-slate-900">{row.name}</div>
                    <div className="text-slate-600">
                      Anzahl: <span className="font-medium tabular-nums">{row.value}</span>
                    </div>
                    <div className="text-slate-600">
                      Anteil: <span className="font-medium">{pct} %</span>
                    </div>
                    {row.name !== 'Neue Leads' && (
                      <div className="text-slate-500">
                        Drop-off vs. Neue Leads:{' '}
                        <span className="font-medium text-amber-700">{drop} %</span>
                      </div>
                    )}
                  </div>
                )
              }
              return null
            }}
          />
          <Funnel
            data={data}
            dataKey="value"
            isAnimationActive
            stroke="#fff"
            strokeWidth={2}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
            <LabelList
              position="right"
              fill="#0f172a"
              stroke="none"
              dataKey="name"
              fontSize={12}
              formatter={
                ((value: any, entry: any) => {
                  const row = entry?.payload ?? {}
                  return `${value} (${row.value ?? ''})`
                }) as any
              }
            />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4 pt-4 border-t border-slate-100">
        {data.map((row: any, i) => {
          const pct = total > 0 ? (row.value / total) : 0
          const dropPct = 1 - pct
          return (
            <div key={row.name} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <div className="text-[11px] font-medium text-slate-700">{row.name}</div>
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                {row.value}
              </div>
              {row.name !== 'Neue Leads' && (
                <div className="text-[11px] text-slate-500 mt-0.5">
                  <span className="text-amber-600 font-medium">
                    {(dropPct * 100).toFixed(0)} %
                  </span>{' '}
                  weniger als Neue Leads
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function CampaignPerfTableClient({ campaigns }: { campaigns: any[] }) {
  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 bg-slate-50 px-6 py-10 rounded-lg m-4 text-center">
        <div className="text-sm font-medium text-slate-800">Keine Kampagnen-Daten</div>
        <div className="text-xs text-slate-500 mt-1">
          Lege Kampagnen im Admin-Bereich an, um Performance zu vergleichen.
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kampagne</TableHead>
            <TableHead>Quelle</TableHead>
            <TableHead className="hidden md:table-cell">Zeitraum</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Zugewiesen</TableHead>
            <TableHead className="text-right hidden lg:table-cell">Abschlüsse</TableHead>
            <TableHead className="text-right hidden xl:table-cell">Ø Verbrauch</TableHead>
            <TableHead className="text-right">Quote</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((c: any) => {
            const stats = c.stats ?? {}
            const avgConsumption =
              stats.avgPower && stats.avgGas
                ? `${Math.round(stats.avgPower)} / ${Math.round(stats.avgGas)}`
                : stats.avgPower
                  ? `${Math.round(stats.avgPower)} S`
                  : stats.avgGas
                    ? `${Math.round(stats.avgGas)} G`
                    : '-'
            const period =
              c.start_date || c.end_date
                ? `${formatDateShort(c.start_date)} – ${formatDateShort(c.end_date)}`
                : '-'
            return (
              <TableRow key={c.id} className="hover:bg-slate-50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'h-2 w-2 rounded-full flex-shrink-0',
                      c.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                    )} />
                    <span className="text-sm font-medium text-slate-900">{c.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-600">
                    {c.source ? SOURCE_LABELS[c.source as keyof typeof SOURCE_LABELS] : '-'}
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell text-xs text-slate-500">
                  {period}
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
                <TableCell className="text-right text-xs text-slate-600 tabular-nums hidden xl:table-cell">
                  {avgConsumption}
                </TableCell>
                <TableCell className="text-right">
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
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
