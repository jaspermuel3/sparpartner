import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { TargetType } from '@/types'
import { TARGET_TYPE_LABELS, formatPercent } from '@/lib/constants'
import { Target } from 'lucide-react'

export function TargetProgressBar({
  label,
  current,
  target,
  type = 'abschluesse',
  className,
}: {
  label?: string
  current: number
  target: number
  type?: TargetType
  className?: string
}) {
  const isPercent = type === 'kontaktquote'
  const displayCurrent = isPercent ? formatPercent(current / 100) : String(current)
  const displayTarget = isPercent ? formatPercent(target / 100) : String(target)
  const pctValue = isPercent ? current : target > 0 ? Math.min(100, (current / target) * 100) : 0
  const pctForProgress = Math.max(0, Math.min(100, pctValue))
  const accent =
    pctForProgress >= 100
      ? 'bg-emerald-500'
      : pctForProgress >= 66
        ? 'bg-blue-500'
        : pctForProgress >= 33
          ? 'bg-amber-500'
          : 'bg-slate-400'

  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-4', className)}>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
          <Target className="h-3.5 w-3.5 text-slate-500" />
          {label ?? TARGET_TYPE_LABELS[type] ?? 'Ziel'}
        </span>
        <span className="tabular-nums text-slate-500">
          <span className="font-semibold text-slate-800">{displayCurrent}</span> / {displayTarget}
        </span>
      </div>
      <Progress
        value={pctForProgress}
        className={cn('h-2.5 [&>div]:transition-all [&>div]:duration-500 [&>div]:', accent)}
      />
      {pctForProgress >= 100 ? (
        <div className="mt-1.5 text-[11px] font-medium text-emerald-600">Ziel erreicht</div>
      ) : (
        <div className="mt-1.5 text-[11px] text-slate-500">
          {isPercent
            ? `${(target - current).toFixed(1)} Prozentpunkte verbleibend`
            : target > 0
              ? `Noch ${Math.max(0, target - current)} bis zum Ziel (${pctForProgress.toFixed(0).replace('.', ',')} %)`
              : 'Kein Ziel gesetzt'}
        </div>
      )}
    </div>
  )
}
