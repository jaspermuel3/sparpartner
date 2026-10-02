import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import type { ReactElement } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

function SparklineMini({
  values,
  color = '#334155',
  width = 90,
  height = 26,
}: {
  values: number[]
  color?: string
  width?: number
  height?: number
}) {
  if (!values || values.length === 0) return null
  const clean = values.map((v) => (Number.isFinite(v) ? v : 0))
  const max = Math.max(1, ...clean)
  const min = Math.min(0, ...clean)
  const range = max - min || 1
  const stepX = clean.length > 1 ? width / (clean.length - 1) : 0
  const points = clean
    .map((v, i) => {
      const x = stepX * i
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const last = clean[clean.length - 1]
  const first = clean[0]
  const up = last >= first
  const stroke = color
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
      {clean.length > 0 && (
        <circle
          cx={stepX * (clean.length - 1)}
          cy={height - ((clean[clean.length - 1] - min) / range) * height}
          r="2.2"
          fill={up ? '#10b981' : '#ef4444'}
        />
      )}
    </svg>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
  loading,
  trendValue,
  trendLabel,
  href,
  sparkline,
  sparklineColor,
  className,
}: {
  label: string
  value: string | number | null | undefined
  hint?: string | null
  icon?: ReactElement
  accent?: 'default' | 'success' | 'danger' | 'warning' | 'brand'
  loading?: boolean
  trendValue?: number | null
  trendLabel?: string | null
  href?: string
  sparkline?: number[]
  sparklineColor?: string
  className?: string
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
    const Wrapper: any = href ? Link : 'div'
    const wrapperProps = href
      ? { href, className: cn('block', className) }
      : { className }
    return (
      <Wrapper {...wrapperProps}>
        <Card className={cn('card-hoverable border border-slate-200 bg-white shadow-sm', href ? undefined : className)}>
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
      </Wrapper>
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

  const defaultSparkColor =
    accent === 'success' ? '#10b981' : accent === 'danger' ? '#ef4444' : accent === 'warning' ? '#f59e0b' : accent === 'brand' ? '#3b82f6' : '#334155'

  const cardContent = (
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="mt-1.5 flex items-end justify-between gap-3">
            <div className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {value ?? '-'}
            </div>
            {sparkline && sparkline.length > 0 && (
              <div className="shrink-0 -mb-0.5">
                <SparklineMini values={sparkline} color={sparklineColor ?? defaultSparkColor} />
              </div>
            )}
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
  )

  if (href) {
    return (
      <Link href={href} className={cn('block group', className)}>
        <Card className="card-hoverable h-full border border-slate-200 bg-white shadow-sm transition group-hover:border-slate-300 group-hover:shadow-md cursor-pointer">
          {cardContent}
        </Card>
      </Link>
    )
  }

  return (
    <Card className={cn('card-hoverable h-full border border-slate-200 bg-white shadow-sm', className)}>
      {cardContent}
    </Card>
  )
}

