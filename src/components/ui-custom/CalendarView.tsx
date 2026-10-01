'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateShort, WEEKDAY_LABELS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const START_HOUR = 8
const END_HOUR = 20
const HOURS_COUNT = END_HOUR - START_HOUR

interface CalendarViewProps {
  callbacks: any[]
  view: 'day' | 'week'
  selectedDate?: Date
  onSelectDate?: (d: Date) => void
  onOpenLead?: (leadId: string) => void
}

function getStatusBg(status: string): string {
  switch (status) {
    case 'erledigt':
      return 'bg-emerald-500/90 border-emerald-600 text-white'
    case 'storniert':
      return 'bg-slate-400/90 border-slate-500 text-white'
    case 'offen':
    default:
      return 'bg-amber-500/90 border-amber-600 text-white'
  }
}

function formatHour(h: number): string {
  return `${h.toString().padStart(2, '0')}:00`
}

function startOfWeek(d: Date): Date {
  const tmp = new Date(d)
  const day = (tmp.getDay() + 6) % 7
  tmp.setDate(tmp.getDate() - day)
  tmp.setHours(0, 0, 0, 0)
  return tmp
}

export function CalendarView({
  callbacks,
  view,
  selectedDate: selectedDateProp,
  onSelectDate,
}: CalendarViewProps) {
  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  const [internalDate, setInternalDate] = useState<Date>(() => {
    if (selectedDateProp) return new Date(selectedDateProp)
    return new Date(today)
  })

  const baseDate = selectedDateProp ? new Date(selectedDateProp) : internalDate

  const setDate = (d: Date) => {
    if (onSelectDate) {
      onSelectDate(d)
    } else {
      setInternalDate(d)
    }
  }

  const dayStart = new Date(baseDate)
  dayStart.setHours(0, 0, 0, 0)
  const weekStart = startOfWeek(baseDate)

  const getDayDate = (offset: number): Date => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + offset)
    return d
  }

  const dateIsSameDay = (a: Date, b: Date): boolean => {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    )
  }

  const dateToDayOffset = (iso: string): number | null => {
    if (view !== 'week') return null
    const d = new Date(iso)
    for (let i = 0; i < 7; i++) {
      if (dateIsSameDay(d, getDayDate(i))) return i
    }
    return null
  }

  const callbacksFiltered = useMemo(() => {
    if (view === 'day') {
      return callbacks.filter((c) => dateIsSameDay(new Date(c.callback_at), dayStart))
    }
    return callbacks.filter((c) => {
      const offset = dateToDayOffset(c.callback_at)
      return offset !== null
    })
  }, [callbacks, view, dayStart.getTime(), weekStart.getTime()])

  const heightPerHour = view === 'day' ? 60 : 40

  const shiftDays = (delta: number) => {
    const nd = new Date(baseDate)
    nd.setDate(nd.getDate() + delta)
    setDate(nd)
  }

  const shiftWeek = (delta: number) => {
    const nd = new Date(baseDate)
    nd.setDate(nd.getDate() + delta * 7)
    setDate(nd)
  }

  const daySelectOptions = useMemo(() => {
    const out: Array<{ value: string; label: string }> = []
    for (let i = -14; i <= 14; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      out.push({
        value: d.toISOString().slice(0, 10),
        label:
          i === 0
            ? 'Heute · ' + formatDateShort(d.toISOString())
            : i === -1
              ? 'Gestern · ' + formatDateShort(d.toISOString())
              : i === 1
                ? 'Morgen · ' + formatDateShort(d.toISOString())
                : WEEKDAY_LABELS[(d.getDay() + 6) % 7] + ' · ' + formatDateShort(d.toISOString()),
      })
    }
    return out
  }, [today])

  const selectedValue = baseDate.toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => (view === 'day' ? shiftDays(-1) : shiftWeek(-1))}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {view === 'day' ? (
            <Select
              value={selectedValue}
              onValueChange={(v) => setDate(new Date(v + 'T00:00:00'))}
            >
              <SelectTrigger className="w-[260px] h-9">
                <SelectValue placeholder="Tag wählen" />
              </SelectTrigger>
              <SelectContent>
                {daySelectOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-9 px-3 inline-flex items-center rounded-md border border-slate-200 bg-white text-sm text-slate-700">
              {formatDateShort(getDayDate(0).toISOString())} –{' '}
              {formatDateShort(getDayDate(6).toISOString())}
            </div>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => (view === 'day' ? shiftDays(1) : shiftWeek(1))}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDate(new Date(today))}
            className="h-9"
          >
            Heute
          </Button>
        </div>
        <div className="text-xs text-slate-500">
          {callbacksFiltered.length} Termin{callbacksFiltered.length === 1 ? '' : 'e'}
        </div>
      </div>

      <div
        className="overflow-auto rounded-xl border border-slate-200 bg-white"
        style={{ minHeight: 400 }}
      >
        {view === 'day' ? (
          <DayView
            callbacks={callbacksFiltered}
            dayStart={dayStart}
            heightPerHour={heightPerHour}
          />
        ) : (
          <WeekView
            callbacks={callbacksFiltered}
            weekStart={weekStart}
            heightPerHour={heightPerHour}
            dateToDayOffset={dateToDayOffset}
          />
        )}
      </div>
    </div>
  )
}

function DayView({
  callbacks,
  dayStart,
  heightPerHour,
}: {
  callbacks: any[]
  dayStart: Date
  heightPerHour: number
}) {
  const totalHeight = HOURS_COUNT * heightPerHour
  return (
    <div className="relative" style={{ minHeight: 400 }}>
      <div className="grid grid-cols-[72px_1fr]">
        <div className="border-r border-slate-100 bg-slate-50/60">
          {Array.from({ length: HOURS_COUNT }).map((_, idx) => {
            const h = START_HOUR + idx
            return (
              <div
                key={h}
                className="px-2 pr-3 text-right text-[11px] text-slate-500 border-b border-slate-100"
                style={{ height: heightPerHour, paddingTop: 4 }}
              >
                {formatHour(h)}
              </div>
            )
          })}
        </div>

        <div className="relative" style={{ height: totalHeight }}>
          {Array.from({ length: HOURS_COUNT }).map((_, idx) => {
            const h = START_HOUR + idx
            return (
              <div
                key={h}
                className="absolute left-0 right-0 border-b border-slate-100"
                style={{ top: idx * heightPerHour, height: heightPerHour }}
              />
            )
          })}

          {callbacks.map((cb) => {
            const dt = new Date(cb.callback_at)
            const hour = dt.getHours()
            const minute = dt.getMinutes()
            if (hour < START_HOUR || hour >= END_HOUR) return null
            const relH = hour - START_HOUR + minute / 60
            const top = relH * heightPerHour
            const height = 30
            const name = [cb.lead?.first_name, cb.lead?.last_name].filter(Boolean).join(' ') || 'Lead'
            const notes = cb.notes || ''
            const tooltip = `${name} · ${formatHour(hour)}${minute > 0 ? ':' + minute.toString().padStart(2, '0') : ''}${notes ? ' · ' + notes : ''}`
            return (
              <Link
                key={cb.id}
                href={`/leads/${cb.lead_id}`}
                title={tooltip}
                className={cn(
                  'absolute left-1 right-1 rounded-md border px-2 py-1 text-[11px] font-medium shadow-sm transition hover:brightness-110 hover:shadow focus:outline-none focus:ring-2 focus:ring-slate-400',
                  getStatusBg(cb.status)
                )}
                style={{
                  top,
                  height,
                  minHeight: 24,
                  overflow: 'hidden',
                }}
              >
                <span className="truncate block">
                  {name} · {dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function WeekView({
  callbacks,
  weekStart,
  heightPerHour,
  dateToDayOffset,
}: {
  callbacks: any[]
  weekStart: Date
  heightPerHour: number
  dateToDayOffset: (iso: string) => number | null
}) {
  const totalHeight = HOURS_COUNT * heightPerHour
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div style={{ minHeight: 400 }}>
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] bg-slate-50/60 border-b border-slate-100 sticky top-0 z-10">
        <div className="px-2 py-2 text-[11px] font-medium text-slate-400" />
        {Array.from({ length: 7 }).map((_, idx) => {
          const d = new Date(weekStart)
          d.setDate(d.getDate() + idx)
          const isToday =
            d.getFullYear() === today.getFullYear() &&
            d.getMonth() === today.getMonth() &&
            d.getDate() === today.getDate()
          return (
            <div
              key={idx}
              className={cn(
                'px-1 py-2 text-center border-l border-slate-100 first:border-l-0',
                isToday ? 'bg-amber-50/60' : ''
              )}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {WEEKDAY_LABELS[idx].slice(0, 2)}
              </div>
              <div
                className={cn(
                  'mt-0.5 inline-flex items-center justify-center rounded-full text-xs font-semibold h-6 w-6',
                  isToday ? 'bg-amber-500 text-white' : 'text-slate-700'
                )}
              >
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
        <div className="border-r border-slate-100 bg-slate-50/60">
          {Array.from({ length: HOURS_COUNT }).map((_, idx) => {
            const h = START_HOUR + idx
            return (
              <div
                key={h}
                className="px-2 pr-3 text-right text-[10px] text-slate-500 border-b border-slate-100"
                style={{ height: heightPerHour, paddingTop: 2 }}
              >
                {formatHour(h)}
              </div>
            )
          })}
        </div>

        {Array.from({ length: 7 }).map((_, dayIdx) => {
          const d = new Date(weekStart)
          d.setDate(d.getDate() + dayIdx)
          const isToday =
            d.getFullYear() === today.getFullYear() &&
            d.getMonth() === today.getMonth() &&
            d.getDate() === today.getDate()

          return (
            <div
              key={dayIdx}
              className={cn(
                'relative border-l border-slate-100 first:border-l-0',
                isToday ? 'bg-amber-50/30' : ''
              )}
              style={{ height: totalHeight }}
            >
              {Array.from({ length: HOURS_COUNT }).map((__, idx) => {
                const h = START_HOUR + idx
                return (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-b border-slate-100/60"
                    style={{ top: idx * heightPerHour, height: heightPerHour }}
                  />
                )
              })}

              {callbacks.map((cb) => {
                const offset = dateToDayOffset(cb.callback_at)
                if (offset !== dayIdx) return null
                const dt = new Date(cb.callback_at)
                const hour = dt.getHours()
                const minute = dt.getMinutes()
                if (hour < START_HOUR || hour >= END_HOUR) return null
                const relH = hour - START_HOUR + minute / 60
                const top = relH * heightPerHour
                const height = 20
                const name = [cb.lead?.first_name, cb.lead?.last_name].filter(Boolean).join(' ') || 'Lead'
                const notes = cb.notes || ''
                const tooltip = `${name} · ${formatHour(hour)}${minute > 0 ? ':' + minute.toString().padStart(2, '0') : ''}${notes ? ' · ' + notes : ''}`
                return (
                  <Link
                    key={cb.id}
                    href={`/leads/${cb.lead_id}`}
                    title={tooltip}
                    className={cn(
                      'absolute left-0.5 right-0.5 rounded border px-1 text-[10px] font-medium shadow-sm transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-slate-400 truncate',
                      getStatusBg(cb.status)
                    )}
                    style={{
                      top,
                      height: Math.max(height, 20),
                      minHeight: 20,
                      overflow: 'hidden',
                      lineHeight: `${height - 2}px`,
                    }}
                  >
                    {name}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
