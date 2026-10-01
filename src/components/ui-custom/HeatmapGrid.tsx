'use client'

import React, { useMemo } from 'react'
import { WEEKDAY_LABELS } from '@/lib/constants'
import type { TimeHeatmapCell } from '@/types'
import { cn } from '@/lib/utils'

const START_HOUR = 8
const END_HOUR = 20
const HOURS_COUNT = END_HOUR - START_HOUR

interface HeatmapGridProps {
  data?: TimeHeatmapCell[]
  userId?: string
}

function generateDemoData(): TimeHeatmapCell[] {
  const cells: TimeHeatmapCell[] = []
  for (let day = 0; day < 7; day++) {
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      const attempts = Math.floor(Math.random() * 16)
      const reached = attempts > 0 ? Math.floor(Math.random() * (attempts + 1)) : 0
      cells.push({
        day_of_week: day,
        hour_of_day: hour,
        attempts,
        reached,
      })
    }
  }
  return cells
}

function getCellColor(rate: number): string {
  if (rate <= 0) return 'bg-slate-100'
  if (rate < 0.125) return 'bg-emerald-50'
  if (rate < 0.25) return 'bg-emerald-100'
  if (rate < 0.375) return 'bg-emerald-200'
  if (rate < 0.5) return 'bg-emerald-300'
  if (rate < 0.625) return 'bg-emerald-400'
  if (rate < 0.75) return 'bg-emerald-500'
  if (rate < 0.875) return 'bg-emerald-600'
  return 'bg-emerald-700'
}

function formatHour(h: number): string {
  return `${h.toString().padStart(2, '0')}:00`
}

export function HeatmapGrid({ data, userId: _userId }: HeatmapGridProps) {
  const cells = useMemo<TimeHeatmapCell[]>(() => {
    if (data && data.length > 0) {
      return data
    }
    return generateDemoData()
  }, [data])

  const cellMap = useMemo(() => {
    const map = new Map<string, TimeHeatmapCell>()
    for (const c of cells) {
      map.set(`${c.day_of_week}-${c.hour_of_day}`, c)
    }
    return map
  }, [cells])

  const legendEntries = [0, 25, 50, 75, 100]
  const legendColors = [
    'bg-slate-100',
    'bg-emerald-100',
    'bg-emerald-300',
    'bg-emerald-500',
    'bg-emerald-700',
  ]

  return (
    <div className="space-y-4">
      <div className="overflow-auto">
        <div className="inline-block min-w-full">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `84px repeat(${HOURS_COUNT}, minmax(0, 1fr))`,
            }}
          >
            <div className="h-7" />
            {Array.from({ length: HOURS_COUNT }).map((_, i) => {
              const h = START_HOUR + i
              return (
                <div
                  key={`header-${h}`}
                  className="h-7 flex items-center justify-start text-[10px] font-medium text-slate-500"
                >
                  {formatHour(h)}
                </div>
              )
            })}

            {Array.from({ length: 7 }).map((_, dayIdx) => (
              <React.Fragment key={`row-${dayIdx}`}>
                <div
                  className="h-6 pr-2 flex items-center justify-end text-[11px] font-medium text-slate-600"
                >
                  {WEEKDAY_LABELS[dayIdx]}
                </div>
                {Array.from({ length: HOURS_COUNT }).map((__, hourIdx) => {
                  const hour = START_HOUR + hourIdx
                  const cell = cellMap.get(`${dayIdx}-${hour}`)
                  const attempts = cell?.attempts ?? 0
                  const reached = cell?.reached ?? 0
                  const rate = attempts > 0 ? reached / attempts : 0
                  const ratePct = Math.round(rate * 100)
                  const tooltip = `${WEEKDAY_LABELS[dayIdx]} ${formatHour(hour)} Uhr: ${attempts} Versuch${attempts === 1 ? '' : 'e'}, ${reached} erreicht${attempts > 0 ? ` (${ratePct}%)` : ''}`
                  return (
                    <div
                      key={`cell-${dayIdx}-${hour}`}
                      title={tooltip}
                      className={cn(
                        'h-6 w-6 rounded-sm border border-slate-200/60 transition hover:ring-2 hover:ring-slate-400 hover:ring-offset-1',
                        getCellColor(rate)
                      )}
                      style={{ minWidth: 16, minHeight: 16 }}
                    />
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 text-[10px] text-slate-500">
        <span className="font-medium text-slate-600">Erfolgsrate:</span>
        {legendEntries.map((pct, idx) => (
          <div key={pct} className="inline-flex items-center gap-1">
            <div
              className={cn(
                'h-3.5 w-3.5 rounded-sm border border-slate-200/60',
                legendColors[idx]
              )}
            />
            <span className="tabular-nums">{pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
