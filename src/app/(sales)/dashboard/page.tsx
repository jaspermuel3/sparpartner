import Link from 'next/link'
import { requireSeller } from '@/lib/auth'
import {
  getSellerDashboardStats,
  getRecentActivity,
  getUpcomingCallbacks,
  getWorklist,
  type WorklistItem,
} from '@/lib/services/leads.service'
import { ensureDefaultTargets } from '@/lib/services/targets.service'
import type { SellerTarget } from '@/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/ui-custom/StatCard'
import { CollapsibleCard } from '@/components/ui-custom/CollapsibleCard'
import { LeadAvatar } from '@/components/ui-custom/LeadAvatar'
import { TargetProgressBar } from '@/components/ui-custom/TargetProgressBar'
import { LeadStatusBadge, ContactResultPill } from '@/components/ui-custom/StatusBadges'
import { CallButton } from '@/components/ui-custom/CallButton'
import { Button } from '@/components/ui/button'
import {
  Coins,
  Users,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Phone,
  PhoneForwarded,
  Plus,
  ArrowRight,
  Clock,
  Activity,
  AlertCircle,
  ListTodo,
  TrendingUp,
} from 'lucide-react'
import {
  formatDate,
  formatDateShort,
  formatPercent,
  formatTime,
  phoneHref,
  formatRelative,
} from '@/lib/constants'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Lead } from '@/types'

export default async function SellerDashboardPage() {
  const user = await requireSeller()
  const heuteStart = new Date()
  heuteStart.setHours(0, 0, 0, 0)
  const heuteISO = heuteStart.toISOString()
  const monthStart = new Date(heuteStart.getFullYear(), heuteStart.getMonth(), 1).toISOString()

  const [stats, activity, callbacks, worklist, targetsRaw] = await Promise.all([
    getSellerDashboardStats(user.id),
    getRecentActivity(user.id, 5),
    getUpcomingCallbacks(user.id),
    getWorklist(user.id, 12),
    ensureDefaultTargets(user.id),
  ])

  const dayTargets = (targetsRaw as SellerTarget[]).filter((t) => t.period_type === 'day')

  const callbacksHeute = callbacks.filter(
    (c: any) => c.callback_at.slice(0, 10) === heuteISO.slice(0, 10),
  )
  const callbacksUeberfaellig = callbacks.filter(
    (c: any) => new Date(c.callback_at).getTime() < Date.now(),
  )

  const dayTargetAbschluesse = dayTargets.find((t) => t.target_type === 'abschluesse')?.target_value ?? 3
  const dayTargetLeads = dayTargets.find((t) => t.target_type === 'leads')?.target_value ?? 10
  const dayTargetQuote = dayTargets.find((t) => t.target_type === 'kontaktquote')?.target_value ?? 70

  const todayAttempts = (activity.attempts ?? []).filter(
    (a: any) => new Date(a.attempt_date).toISOString() >= heuteISO,
  )
  const uniqueLeadsKontaktiert = new Set(todayAttempts.map((a: any) => a.lead_id)).size
  const kontaktQuoteToday =
    stats.leads_today > 0 ? Math.min(100, (uniqueLeadsKontaktiert / stats.leads_today) * 100) : 0
  const dayCurrentLeadsKontakt = stats.leads_today
  const monthAbschlüsse =
    (activity.statuses ?? []).filter(
      (s: any) => s.new_status === 'closed' && s.created_at >= monthStart,
    ).length + (stats.abschlüsse - 0)

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Hallo, ${user.full_name?.split(' ')[0] ?? 'Team'} 👋`}
        description="Übersicht über deine aktuelle Arbeit und fällige Rückrufe."
        breadcrumb={[{ label: 'Dashboard' }]}
        actions={
          <Button
            asChild
            size="lg"
            className="h-11 bg-gradient-to-r from-slate-900 to-slate-700 px-6 text-sm shadow-md"
          >
            <Link href="/request-lead" className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Lead anfordern
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <Suspense fallback={<DashboardGridSkeleton />}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Token-Guthaben"
            value={stats.token_balance}
            hint={
              stats.token_balance === 0
                ? 'Keine Tokens mehr – bitte Admin kontaktieren.'
                : '1 Lead = 1 Token'
            }
            icon={<Coins className="h-4 w-4" />}
            accent={stats.token_balance === 0 ? 'danger' : stats.token_balance < 5 ? 'warning' : 'brand'}
            trendValue={stats.trends?.abschlussquote_vs_yesterday_pct}
            trendLabel="Quote"
          />
          <StatCard
            label="Meine Leads"
            value={stats.leads_total}
            hint={`${stats.leads_today} neue Zuweisung heute`}
            icon={<Users className="h-4 w-4" />}
            accent="default"
            trendValue={stats.trends?.leads_today_vs_yesterday_pct}
            trendLabel="vs. gestern"
          />
          <StatCard
            label="Abschlüsse"
            value={stats.abschlüsse}
            hint={`Abschlussquote ${formatPercent(stats.abschluss_quote)}`}
            icon={<CheckCircle2 className="h-4 w-4" />}
            accent="success"
            trendValue={stats.trends?.abschlussquote_vs_yesterday_pct}
            trendLabel="Quote vs. gestern"
          />
          <StatCard
            label="Offene Rückrufe"
            value={stats.callbacks_offen}
            hint={
              callbacksUeberfaellig.length > 0
                ? `${callbacksUeberfaellig.length} überfällig`
                : callbacksHeute.length > 0
                  ? `${callbacksHeute.length} Rückrufe heute`
                  : 'Keine Rückrufe heute'
            }
            icon={
              stats.callbacks_ueberfaellig > 0 ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CalendarDays className="h-4 w-4" />
              )
            }
            accent={stats.callbacks_ueberfaellig > 0 ? 'danger' : 'warning'}
          />
        </div>
      </Suspense>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <TargetProgressBar
          label="Abschlüsse heute"
          current={stats.abschlüsse}
          target={Number(dayTargetAbschluesse)}
          type="abschluesse"
        />
        <TargetProgressBar
          label="Zugeordnete Leads heute"
          current={stats.leads_today}
          target={Number(dayTargetLeads)}
          type="leads"
        />
        <TargetProgressBar
          label="Kontaktquote heute"
          current={Number(kontaktQuoteToday.toFixed(1))}
          target={Number(dayTargetQuote)}
          type="kontaktquote"
        />
      </div>

      <CollapsibleCard
        id="dashboard-worklist"
        title="Als Nächstes"
        icon={<ListTodo className="h-4 w-4 text-blue-600" />}
        defaultOpen
      >
        <Suspense fallback={<WorklistSkeleton />}>
          <WorklistList items={worklist as WorklistItem[]} />
        </Suspense>
      </CollapsibleCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <CollapsibleCard
          id="dashboard-activity"
          title="Letzte Aktivitäten"
          icon={<Activity className="h-4 w-4 text-slate-500" />}
          defaultOpen
          className="lg:col-span-2"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/my-leads">Alle Leads →</Link>
            </Button>
          }
        >
          <Suspense fallback={<ActivitySkeleton />}>
            <ActivityList attempts={activity.attempts as any[]} statuses={activity.statuses as any[]} />
          </Suspense>
        </CollapsibleCard>

        <CollapsibleCard
          id="dashboard-callbacks"
          title="Nächste Rückrufe"
          icon={<PhoneForwarded className="h-4 w-4 text-slate-500" />}
          defaultOpen
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/callbacks">Öffnen →</Link>
            </Button>
          }
        >
          <Suspense fallback={<CallbacksSkeleton />}>
            <div className="space-y-2">
              {callbacks.length === 0 && (
                <EmptyState
                  icon={<PhoneForwarded className="h-5 w-5 text-slate-400" />}
                  title="Keine Rückrufe geplant"
                  hint="Plane Rückrufe direkt in der Lead-Detailansicht."
                />
              )}
              {callbacks.map((c: any) => {
                const istUeberfaellig = new Date(c.callback_at).getTime() < Date.now()
                return (
                  <Link
                    key={c.id}
                    href={`/leads/${c.lead_id}`}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg border bg-slate-50/50 p-3 transition hover:bg-white hover:shadow-sm',
                      istUeberfaellig
                        ? 'border-red-200 bg-red-50/40 hover:border-red-300 urgent-pulse'
                        : 'border-slate-100 hover:border-slate-200',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                        istUeberfaellig
                          ? 'border-red-200 bg-red-50 text-red-600'
                          : 'border-amber-200 bg-amber-50 text-amber-600',
                      )}
                    >
                      {istUeberfaellig ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {c.lead?.first_name} {c.lead?.last_name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{formatDateShort(c.callback_at)}</span>
                        <span>·</span>
                        <span>{formatTime(c.callback_at)}</span>
                        {istUeberfaellig && (
                          <>
                            <span>·</span>
                            <span className="font-medium text-red-600">überfällig</span>
                          </>
                        )}
                      </div>
                    </div>
                    <CallButton
                      phone={c.lead?.phone}
                      className="ml-auto inline-flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-slate-200 text-slate-600 opacity-0 transition group-hover:opacity-100 hover:bg-slate-50"
                    />
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-600" />
                  </Link>
                )
              })}
            </div>
          </Suspense>
        </CollapsibleCard>
      </div>
    </div>
  )
}

function WorklistList({ items }: { items: WorklistItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ListTodo className="h-5 w-5 text-slate-400" />}
        title="Arbeitsliste ist leer"
        hint="Fordere einen Lead an oder plane Rückrufe, um loszulegen."
      />
    )
  }
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((it) => {
        const color =
          it.kind === 'callback_overdue'
            ? 'border-red-200 bg-red-50/40'
            : it.kind === 'new_lead'
              ? 'border-blue-200 bg-blue-50/40'
              : it.kind === 'callback_soon'
                ? 'border-amber-200 bg-amber-50/40'
                : 'border-slate-200 bg-slate-50/60'
        const urgencyIcon =
          it.kind === 'callback_overdue' ? (
            <AlertCircle className="h-4 w-4 text-red-600" />
          ) : it.kind === 'new_lead' ? (
            <Plus className="h-4 w-4 text-blue-600" />
          ) : it.kind === 'callback_soon' ? (
            <Clock className="h-4 w-4 text-amber-600" />
          ) : (
            <TrendingUp className="h-4 w-4 text-slate-600" />
          )
        return (
          <li key={it.id}>
            <Link
              href={`/leads/${it.lead_id}`}
              className={cn(
                'card-hoverable flex items-start gap-3 rounded-xl border p-3 transition',
                color,
              )}
            >
              <LeadAvatar firstName={it.title.split(' ')[0]} lastName={it.title.split(' ').slice(1).join(' ')} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{it.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600">
                      {urgencyIcon}
                      <span className="font-medium">{it.reason}</span>
                    </div>
                  </div>
                  {(it.kind === 'callback_overdue' || it.kind === 'callback_soon') && it.callback_at && (
                    <div className="shrink-0 text-right text-[11px] text-slate-500">
                      <div>{formatRelative(it.callback_at)}</div>
                      <div>{formatTime(it.callback_at)}</div>
                    </div>
                  )}
                  {(it.kind === 'new_lead' || it.kind === 'inactive_lead') && it.assigned_at && (
                    <div className="shrink-0 text-right text-[11px] text-slate-500">
                      vor {formatDaysSince(it.assigned_at)} Tag(en)
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <CallButton
                    phone={it.phone ?? undefined}
                    label="Anrufen"
                    className="inline-flex min-h-[36px] min-w-[36px] items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  />
                  <span className="inline-flex min-h-[36px] items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50">
                    Öffnen
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </span>
                </div>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function formatDaysSince(iso: string | null | undefined): number | string {
  if (!iso) return '-'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '-'
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

function ActivityList({ attempts, statuses }: { attempts: any[]; statuses: any[] }) {
  const merged = [
    ...attempts.map((a: any) => ({
      type: 'attempt' as const,
      at: a.attempt_date,
      data: a,
    })),
    ...statuses.map((s: any) => ({
      type: 'status' as const,
      at: s.created_at,
      data: s,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  if (merged.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="h-5 w-5 text-slate-400" />}
        title="Noch keine Aktivitäten"
        hint="Fordere deinen ersten Lead an, um loszulegen."
      />
    )
  }

  return (
    <ul className="space-y-2">
      {merged.slice(0, 7).map((entry, idx) => {
        const firstName = entry.data.lead?.first_name
        const lastName = entry.data.lead?.last_name
        return (
          <li
            key={idx}
            className="card-hoverable flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/40 p-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
              {entry.type === 'attempt' ? (
                <Phone className="h-3.5 w-3.5" />
              ) : (
                <TrendingUp className="h-3.5 w-3.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm text-slate-800">
                <span className="font-medium text-slate-900">
                  {entry.type === 'attempt' ? 'Kontaktversuch' : 'Statuswechsel'}
                </span>
                <span className="text-slate-300">·</span>
                <Link
                  href={`/leads/${entry.type === 'attempt' ? entry.data.lead_id : entry.data.lead?.id}`}
                  className="truncate text-slate-500 hover:underline"
                >
                  {firstName} {lastName}
                </Link>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{formatDate(entry.at)}</span>
                {entry.type === 'attempt' ? (
                  <ContactResultPill result={entry.data.result} />
                ) : (
                  <LeadStatusBadge status={entry.data.new_status as any} />
                )}
                {entry.type === 'attempt' && entry.data.notes && (
                  <span className="text-slate-500">– {entry.data.notes}</span>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode
  title: string
  hint?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white">
        {icon}
      </div>
      <div className="text-sm font-medium text-slate-800">{title}</div>
      {hint && <div className="mt-1 max-w-sm text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

function DashboardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <Skeleton className="mb-2 h-3 w-24" />
          <Skeleton className="mb-1 h-7 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  )
}
function ActivitySkeleton() {
  return (
    <ul className="space-y-3 pt-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  )
}
function CallbacksSkeleton() {
  return (
    <ul className="space-y-2 pt-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  )
}
function WorklistSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-100 bg-white p-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
