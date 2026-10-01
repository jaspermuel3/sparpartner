import Link from 'next/link'
import { requireSeller } from '@/lib/auth'
import { getMyCallbacks, updateCallbackStatus as svcUpdateCallbackStatus } from '@/lib/services/leads.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { CallbackStatusBadge, LeadStatusBadge } from '@/components/ui-custom/StatusBadges'
import { PhoneLink } from '@/components/ui-custom/PhoneLink'
import { Button } from '@/components/ui/button'
import { CalendarView } from '@/components/ui-custom/CalendarView'
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
} from 'lucide-react'
import {
  formatDateShort,
  formatTime,
  formatPhone,
  phoneHref,
} from '@/lib/constants'
import { updateCallbackStatusAction } from '@/app/actions'

export const metadata = { title: 'Rückrufe' }

export default async function CallbacksPage() {
  const user = await requireSeller()
  const callbacks = (await getMyCallbacks(user.id)) as any[] ?? []

  const jetzt = Date.now()
  callbacks.sort((a, b) => new Date(a.callback_at).getTime() - new Date(b.callback_at).getTime())
  const ueberfaellig = callbacks.filter((c) => c.status === 'offen' && new Date(c.callback_at).getTime() < jetzt)
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)
  const morgen = new Date(heute)
  morgen.setDate(morgen.getDate() + 1)
  const heuteISO = heute.toISOString().slice(0, 10)
  const callbacksHeute = callbacks.filter((c) => c.callback_at.slice(0, 10) === heuteISO)
  const offen = callbacks.filter((c) => c.status === 'offen')

  const breadcrumb = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Rückrufe' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rückrufe"
        description={`${offen.length} offene Rückrufe · ${callbacksHeute.length} heute · ${ueberfaellig.length} überfällig`}
        breadcrumb={breadcrumb}
      />

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

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-0">
              {callbacks.length === 0 && (
                <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl m-5 px-6 py-12 text-center">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400">
                    <PhoneForwarded className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-medium text-slate-800">Keine Rückrufe geplant</div>
                  <div className="mt-1 text-xs text-slate-500 max-w-xs">
                    Plane Rückrufe direkt in einer Lead-Detailansicht, um keine Termine zu vergessen.
                  </div>
                </div>
              )}

              <ul className="divide-y divide-slate-100">
                {callbacks.map((c) => {
                  const ueber = c.status === 'offen' && new Date(c.callback_at).getTime() < jetzt
                  return (
                    <li
                      key={c.id}
                      className={
                        'p-4 sm:p-5 transition hover:bg-slate-50' +
                        (ueber ? ' bg-red-50/40' : '')
                      }
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-4">
                          <div
                            className={
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ' +
                              (ueber
                                ? 'border-red-200 bg-red-50 text-red-600'
                                : c.status === 'erledigt'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                                  : 'border-amber-200 bg-amber-50 text-amber-600')
                            }
                          >
                            <CalendarDays className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/leads/${c.lead_id}`}
                                className="text-sm font-semibold text-slate-900 hover:underline"
                              >
                                {c.lead?.first_name} {c.lead?.last_name}
                              </Link>
                              <LeadStatusBadge status={c.lead?.status} />
                              <CallbackStatusBadge status={c.status} />
                              {ueber && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                                  <AlertCircle className="h-3 w-3" />
                                  überfällig
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                                <Clock className="h-3 w-3" />
                                {formatDateShort(c.callback_at)} · {formatTime(c.callback_at)}
                              </span>
                              <span>·</span>
                              <PhoneLink
                                phone={c.lead?.phone}
                                className="inline-flex items-center gap-1 hover:underline"
                              >
                                <Phone className="h-3 w-3" />
                                {formatPhone(c.lead?.phone)}
                              </PhoneLink>
                            </div>
                            {c.notes && (
                              <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600">
                                {c.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:min-w-[170px] sm:justify-end">
                          <Button variant="outline" size="sm" asChild>
                            <a href={phoneHref(c.lead?.phone)}>
                              <Phone className="mr-1.5 h-4 w-4" /> Anrufen
                            </a>
                          </Button>
                          <Button size="sm" variant="default" asChild>
                            <Link href={`/leads/${c.lead_id}`}>
                              Öffnen <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>

                      {c.status === 'offen' && (
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <form action={updateCallbackStatusAction as any} className="m-0">
                            <input type="hidden" name="callbackId" value={c.id} />
                            <input type="hidden" name="leadId" value={c.lead_id} />
                            <input type="hidden" name="status" value="erledigt" />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Als erledigt markieren
                            </button>
                          </form>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="day" className="mt-4">
          <CalendarView callbacks={callbacks} view="day" />
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          <CalendarView callbacks={callbacks} view="week" />
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
