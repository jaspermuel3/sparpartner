import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { requireUser } from '@/lib/auth'
import { getLeadWithDetails } from '@/lib/services/leads.service'
import { getCancellationForLead } from '@/lib/services/admin.service'
import { LeadStatusBadge } from '@/components/ui-custom/StatusBadges'
import { LeadAvatar } from '@/components/ui-custom/LeadAvatar'
import LeadDetailContent from './LeadTabsPanel'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  ChevronUp,
  Clock,
  UserCircle,
  ListTodo,
  History,
  Tag as TagIcon,
} from 'lucide-react'
import {
  formatDateShort,
  formatDaysSince,
  leadAgeClass,
  phoneHref,
} from '@/lib/constants'
import type { LeadStatus, LeadWithDetails, UserRole } from '@/types'

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const viewer = await requireUser()
  const listHref = viewer.role === 'admin' ? '/admin/leads' : '/my-leads'

  return (
    <div className="space-y-3">
      <Suspense fallback={<LeadDetailHeaderSkeleton listHref={listHref} />}>
        <LeadDetailDataLoader params={params} viewerRole={viewer.role} viewerId={viewer.id} />
      </Suspense>
    </div>
  )
}

async function LeadDetailDataLoader({
  params,
  viewerRole,
  viewerId,
}: {
  params: { id: string }
  viewerRole: UserRole
  viewerId: string
}) {
  const lead = (await getLeadWithDetails(params.id, viewerId, viewerRole)) as LeadWithDetails | null
  if (!lead) notFound()

  const assignedUser: any = (lead as any).assigned_user
  const campaign: any = (lead as any).campaign
  const callbacks = ((lead as any).callbacks ?? []) as any[]
  const contactAttempts = ((lead as any).contact_attempts ?? []) as any[]
  const statusHistory = ((lead as any).status_history ?? []) as any[]
  const tags = (lead as any).tags ?? []
  const documents = (lead as any).documents ?? []
  const cancellation = await getCancellationForLead(lead.id)

  const sortedAttempts = [...contactAttempts].sort(
    (a, b) => new Date(b.attempt_date).getTime() - new Date(a.attempt_date).getTime(),
  )
  const lastContactAt = sortedAttempts[0]?.attempt_date ?? null
  const attemptsCount = contactAttempts.length
  const openCallbacks = callbacks
    .filter((c: any) => c.status === 'offen')
    .sort((a, b) => new Date(a.callback_at).getTime() - new Date(b.callback_at).getTime())
  const openCallbacksCount = openCallbacks.length
  const nextCallbackAt = openCallbacks[0]?.callback_at ?? null
  const openCallbackOverdue = nextCallbackAt ? new Date(nextCallbackAt).getTime() < Date.now() - 60_000 : false
  const leadAge = formatDaysSince(lead.created_at)

  const listHref = viewerRole === 'admin' ? '/admin/leads' : '/my-leads'

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <Link
            href={listHref}
            aria-label="Zurück zur Liste"
            className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <LeadAvatar firstName={lead.first_name} lastName={lead.last_name} size="lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 truncate">
                {lead.first_name} {lead.last_name}
              </h1>
              <LeadStatusBadge status={lead.status as LeadStatus} />
              {(lead as any).is_on_hold ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  <Clock className="h-3 w-3" /> Hold
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 tabular-nums">
              <span>ID: {lead.id.slice(0, 8)}…</span>
              <span className="text-slate-300">·</span>
              <span>erstellt {formatDateShort(lead.created_at)}</span>
              {assignedUser && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1">
                    <UserCircle className="h-3 w-3" />
                    {assignedUser.full_name ?? assignedUser.email}
                  </span>
                </>
              )}
            </div>
          </div>
            </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <Link
            href={listHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Zur Liste
            <ChevronUp className="h-3 w-3 -rotate-90" />
          </Link>
        </div>
      </div>

      <LeadDetailContent
        lead={{
          id: lead.id,
          first_name: lead.first_name,
          last_name: lead.last_name,
          status: lead.status,
          phone: lead.phone,
          email: lead.email,
          street: lead.street,
          zip: lead.zip,
          city: lead.city,
          source: lead.source,
          product: lead.product,
          power_consumption: (lead as any).power_consumption ?? null,
          gas_consumption: (lead as any).gas_consumption ?? null,
          notes: lead.notes ?? null,
          created_at: lead.created_at,
          is_on_hold: (lead as any).is_on_hold ?? false,
          hold_notes: (lead as any).hold_notes ?? null,
          assigned_user: assignedUser ? { full_name: assignedUser?.full_name ?? null, email: assignedUser?.email ?? null } : null,
          campaign: campaign ? { name: campaign?.name ?? null } : null,
        }}
        viewerRole={viewerRole}
        viewerId={viewerId}
        cancellation={cancellation}
        listHref={listHref}
        lastContactAt={lastContactAt}
        attemptsCount={attemptsCount}
        openCallbacks={openCallbacks as any}
        openCallbacksCount={openCallbacksCount}
        openCallbackOverdue={openCallbackOverdue}
        nextCallbackAt={nextCallbackAt}
        leadAge={leadAge}
        leadAgeClass={leadAgeClass(leadAge)}
        contactAttempts={contactAttempts as any}
        statusHistory={statusHistory as any}
        callbacks={callbacks as any}
        tags={tags}
        documents={documents}
      />
    </>
  )
}

function LeadDetailHeaderSkeleton({ listHref }: { listHref: string }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <Link
            href={listHref}
            aria-label="Zurück zur Liste"
            className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-7 w-52 sm:w-72 rounded-lg" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-3 w-1 w-1 rounded-full bg-slate-300" />
                <Skeleton className="h-3 w-32 rounded" />
                <Skeleton className="h-3 w-1 w-1 rounded-full bg-slate-300" />
                <Skeleton className="h-3 w-28 rounded" />
              </div>
            </div>
          </div>
        </div>
        <Skeleton className="hidden sm:block h-9 w-24 rounded-lg" />
      </div>

      <div className="space-y-4 pb-48">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-6 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-12 w-full rounded-lg" />
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5 shadow-sm">
              <Skeleton className="h-4 w-40" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
          <div className="space-y-4 self-start lg:sticky lg:top-[64px]">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-24" />
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
