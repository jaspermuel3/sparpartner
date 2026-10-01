'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { CallbackStatusBadge, LeadStatusBadge } from '@/components/ui-custom/StatusBadges'
import { PhoneLink } from '@/components/ui-custom/PhoneLink'
import { CalendarView } from '@/components/ui-custom/CalendarView'
import { LeadAvatar } from '@/components/ui-custom/LeadAvatar'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import {
  PhoneForwarded,
  CalendarDays,
  Clock,
  AlertCircle,
  CheckCircle2,
  Phone,
  ArrowUpRight,
  List,
  Calendar,
  CalendarRange,
  Mail,
} from 'lucide-react'
import {
  formatDateShort,
  formatTime,
  formatPhone,
  phoneHref,
  formatRelative,
  formatDaysSince,
} from '@/lib/constants'
import { updateCallbackStatusAction } from '@/app/actions'
import { cn } from '@/lib/utils'

export function CallbacksClient({ callbacks }: { callbacks: any[] }) {
  const router = useRouter()
  const jetzt = Date.now()
  const sortedCallbacks = [...callbacks].sort(
    (a, b) => new Date(a.callback_at).getTime() - new Date(b.callback_at).getTime(),
  )
  const ueberfaellig = sortedCallbacks.filter(
    (c) => c.status === 'offen' && new Date(c.callback_at).getTime() < jetzt,
  )
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)
  const heuteISO = heute.toISOString().slice(0, 10)
  const callbacksHeute = sortedCallbacks.filter((c) => c.callback_at.slice(0, 10) === heuteISO)
  const offen = sortedCallbacks.filter((c) => c.status === 'offen')

  return (
    <div className="space-y-6">
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list" className="inline-flex items-center gap-1.5">
            <List className="h-3.5 w-3.5" />
            Liste
          </TabsTrigger>
          <TabsTrigger value="day" className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Tag
          </TabsTrigger>
          <TabsTrigger value="week" className="inline-flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5" />
            Woche
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MiniStat label="Offen" value={offen.length} accent="warning" icon={<CalendarDays className="h-4 w-4" />} />
            <MiniStat label="Heute" value={callbacksHeute.length} accent="default" icon={<Clock className="h-4 w-4" />} />
            <MiniStat
              label="Überfällig"
              value={ueberfaellig.length}
              accent="danger"
              icon={<AlertCircle className="h-4 w-4" />}
            />
          </div>

          {sortedCallbacks.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm">
                <PhoneForwarded className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-slate-800">Keine Rückrufe geplant</div>
              <div className="mt-1 text-xs text-slate-500 max-w-xs">
                Plane Rückrufe direkt in einer Lead-Detailansicht, um keine Termine zu vergessen.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sortedCallbacks.map((c, idx) => {
              const ueber = c.status === 'offen' && new Date(c.callback_at).getTime() < jetzt
              const lead = c.lead ?? {}
              const statusKey = (c.status ?? 'offen') as 'offen' | 'erledigt' | 'storniert'
              const relativeCb = formatRelative(c.callback_at)
              const exactCbTime = formatTime(c.callback_at)
              const exactCbDate = formatDateShort(c.callback_at)
              const detailUrl = `/leads/${c.lead_id}`
              const staggerDelay = Math.min(600, 40 + idx * 40)

              const STATUS_ACCENT: Record<string, string> = {
                offen: ueber ? 'bg-red-500' : 'bg-orange-500',
                erledigt: 'bg-emerald-500',
                storniert: 'bg-slate-400',
              }
              const STATUS_SOFT_BG: Record<string, string> = {
                offen: ueber ? 'bg-red-50/40' : 'bg-orange-50/40',
                erledigt: 'bg-emerald-50/40',
                storniert: 'bg-slate-50',
              }

              function navigate(e: React.MouseEvent | React.KeyboardEvent) {
                const target = e.target as HTMLElement
                if (target.closest('button, a, [role=combobox], input, textarea, [data-no-nav]')) return
                router.push(detailUrl)
              }

              return (
                <div
                  key={c.id}
                  onClick={navigate}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(e)
                    }
                  }}
                  className={cn(
                    'group stagger-item relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2',
                    'transition-all duration-200 ease-out',
                    'hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300',
                    STATUS_SOFT_BG[statusKey] ?? 'bg-white',
                  )}
                  style={{ animationDelay: `${staggerDelay}ms` }}
                >
                  <div className={cn('absolute inset-y-0 left-0 w-1', STATUS_ACCENT[statusKey] ?? 'bg-slate-300')} />

                  <div className="flex gap-3 p-3.5 sm:p-4 pl-4">
                    <div className="relative shrink-0">
                      <Link href={detailUrl} tabIndex={-1} onClick={(e) => e.stopPropagation()} className="block" aria-hidden="true">
                        <LeadAvatar firstName={lead.first_name} lastName={lead.last_name} size="md" className="h-11 w-11 ring-2 ring-white shadow-sm" />
                      </Link>
                      {ueber ? (
                        <span
                          title="Überfällig"
                          className="absolute -right-0.5 -bottom-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 text-white shadow-sm pulse-dot"
                        >
                          <AlertCircle className="h-2.5 w-2.5" />
                        </span>
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link
                              href={detailUrl}
                              onClick={(e) => e.stopPropagation()}
                              className="block truncate text-sm font-semibold text-slate-900 hover:underline decoration-slate-300 underline-offset-2"
                            >
                              {lead.first_name ?? '—'} {lead.last_name ?? ''}
                            </Link>
                            {ueber ? (
                              <span
                                className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-700 pulse-ring-inline"
                                onClick={(e) => e.preventDefault()}
                              >
                                <AlertCircle className="h-2.5 w-2.5" />
                                Überfällig
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            {lead.status && <LeadStatusBadge status={lead.status as any} showPop={false} />}
                            <CallbackStatusBadge status={c.status} />
                          </div>
                        </div>

                        <div
                          className={cn(
                            'shrink-0 text-right w-[92px]',
                            ueber ? 'text-red-600' : statusKey === 'offen' ? 'text-orange-600' : '',
                          )}
                        >
                          <div className="text-[10.5px] font-semibold tabular-nums leading-none">
                            {relativeCb}
                          </div>
                          <div className="mt-1 inline-flex items-center gap-1 text-[9.5px] text-slate-400 tabular-nums whitespace-nowrap">
                            <CalendarDays className="h-2.5 w-2.5" />
                            {exactCbDate} · {exactCbTime}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 space-y-1">
                        {lead.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                            <PhoneLink
                              phone={lead.phone}
                              className="truncate text-xs text-slate-600 tabular-nums"
                            >
                              {formatPhone(lead.phone)}
                            </PhoneLink>
                          </div>
                        ) : null}
                        {lead.email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                            <a
                              href={`mailto:${lead.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="truncate text-xs text-slate-600 hover:underline"
                            >
                              {lead.email}
                            </a>
                          </div>
                        ) : null}
                        {c.notes && (
                          <div className="mt-1.5 rounded-lg border border-slate-100 bg-white/70 px-2.5 py-1.5 text-[11px] text-slate-600 line-clamp-2">
                            {c.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className={cn(
                      'flex items-center justify-between gap-2 border-t border-slate-100/80 bg-white/60 px-3.5 sm:px-4 pl-4 py-2',
                      'opacity-80 group-hover:opacity-100 transition-opacity',
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {lead.phone ? (
                        <a
                          href={phoneHref(lead.phone)}
                          title="Anrufen"
                          aria-label="Anrufen"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                      {statusKey === 'offen' ? (
                        <form action={updateCallbackStatusAction as any} className="m-0" onSubmit={(e) => e.stopPropagation()}>
                          <input type="hidden" name="callbackId" value={c.id} />
                          <input type="hidden" name="leadId" value={c.lead_id} />
                          <input type="hidden" name="status" value="erledigt" />
                          <button
                            type="submit"
                            title="Als erledigt markieren"
                            aria-label="Als erledigt markieren"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm hover:bg-emerald-100 hover:text-emerald-800 transition-all"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mr-1">
                        Öffnen
                      </span>
                      <Link
                        href={detailUrl}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Lead öffnen"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-900 text-white shadow-sm hover:bg-slate-800 hover:scale-105 transition-all"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="day" className="mt-4">
          <CalendarView callbacks={sortedCallbacks} view="day" />
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          <CalendarView callbacks={sortedCallbacks} view="week" />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MiniStat({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: number
  icon: React.ReactNode
  accent: 'default' | 'warning' | 'danger'
}) {
  const cls: Record<string, string> = {
    default: 'bg-slate-50 text-slate-600 border-slate-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border shadow-sm ${cls[accent]}`}>
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}

export default CallbacksClient
