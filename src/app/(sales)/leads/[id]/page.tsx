import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getLeadWithDetails } from '@/lib/services/leads.service'
import { LeadStatusBadge } from '@/components/ui-custom/StatusBadges'
import { LeadAvatar } from '@/components/ui-custom/LeadAvatar'
import LeadDetailContent from './LeadTabsPanel'
import {
  ArrowLeft,
  ChevronUp,
  Clock,
  UserCircle,
} from 'lucide-react'
import {
  formatDateShort,
  formatDaysSince,
  leadAgeClass,
  phoneHref,
} from '@/lib/constants'
import type { LeadStatus, LeadWithDetails } from '@/types'

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const viewer = await requireUser()
  const lead = (await getLeadWithDetails(params.id, viewer.id, viewer.role)) as LeadWithDetails | null
  if (!lead) notFound()

  const assignedUser: any = (lead as any).assigned_user
  const campaign: any = (lead as any).campaign
  const callbacks = ((lead as any).callbacks ?? []) as any[]
  const contactAttempts = ((lead as any).contact_attempts ?? []) as any[]
  const statusHistory = ((lead as any).status_history ?? []) as any[]
  const tags = (lead as any).tags ?? []
  const documents = (lead as any).documents ?? []

  // Summary berechnen
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

  const listHref = viewer.role === 'admin' ? '/admin/leads' : '/my-leads'

  return (
    <div className="space-y-3">
      {/* Kompakte Kopfzeile (Vorschlag 8) - Server gerendert, kein Client nötig */}
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

        {/* Rechte Seite: Quick Link Zur Liste (Anruf/Mail sind im Sticky-Footer) */}
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

      {/* Alles Weitere ist Client Component: Pipeline, Scorecard, Tabs, Sidebar, ActionBar */}
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
    </div>
  )
}
