import { Card, CardContent } from '@/components/ui/card'
import type { ReactElement } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
  loading,
  trendValue,
  trendLabel,
}: {
  label: string
  value: string | number | null | undefined
  hint?: string | null
  icon?: ReactElement
  accent?: 'default' | 'success' | 'danger' | 'warning' | 'brand'
  loading?: boolean
  trendValue?: number | null
  trendLabel?: string | null
}) {
  const accentStyles: Record<NonNullable<typeof accent>, string> = {
    default: 'bg-slate-50 text-slate-600 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    brand: 'bg-blue-50 text-blue-700 border-blue-200',
  }
  const style = accentStyles[accent ?? 'default']

  if (loading) {
    return (
      <Card className="card-hoverable border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className={cn('h-9 w-9 rounded-lg border', style)} />
          </div>
        </CardContent>
      </Card>
    )
  }

  const trendDir =
    typeof trendValue !== 'number' || Number.isNaN(trendValue)
      ? ('flat' as const)
      : trendValue > 0
        ? ('up' as const)
        : trendValue < 0
          ? ('down' as const)
          : ('flat' as const)

  const TrendIcon = trendDir === 'up' ? TrendingUp : trendDir === 'down' ? TrendingDown : Minus
  const trendColor =
    trendDir === 'up'
      ? 'text-emerald-600'
      : trendDir === 'down'
        ? 'text-red-600'
        : 'text-slate-500'

  return (
    <Card className="card-hoverable border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {value ?? '-'}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              {hint !== undefined && hint !== null && (
                <span className="text-slate-500">{hint}</span>
              )}
              {(trendDir !== 'flat' || trendLabel) && (
                <span className={cn('inline-flex items-center gap-1 font-medium tabular-nums', trendColor)}>
                  <TrendIcon className="h-3 w-3" />
                  {trendDir !== 'flat'
                    ? `${trendDir === 'up' ? '+' : ''}${Math.abs(trendValue!).toFixed(1).replace('.', ',')} %`
                    : trendLabel || 'unverändert'}
                  {trendDir !== 'flat' && trendLabel && (
                    <span className="text-slate-400">({trendLabel})</span>
                  )}
                </span>
              )}
            </div>
          </div>
          {icon && (
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm',
                style,
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

