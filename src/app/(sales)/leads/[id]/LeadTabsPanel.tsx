'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { CopyButton } from '@/components/ui-custom/CopyButton'
import {
  StatusFormCard,
  NotesFormCard,
  ContactAttemptForm,
  CallbackForm,
  CallbackQuickActions,
  CancellationRequestCard,
} from './LeadClientForms'
import {
  LeadActionBar,
  LeadTagsPanel,
  LeadDocumentsPanel,
  TimelineWithFilter,
  LeadPipeline,
  LeadScorecard,
  NextStepPanel,
  MiniTimelineSidebar,
  CompactTagsSidebar,
  CompactTagsInline,
  CompactStatusHistory,
  SecondaryInfoCard,
} from './LeadDetailClient'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Phone,
  Mail,
  CalendarDays,
  Clock,
  Layers,
  Pencil,
  Tag as TagIcon,
  History,
  FileText as FileTextIcon,
  Sparkles,
  UserCircle,
} from 'lucide-react'
import {
  formatDateShort,
  formatTime,
  formatPhone,
  phoneHref,
} from '@/lib/constants'
import type { LeadStatus, Tag, LeadDocument, Callback, ContactAttempt, LeadStatusHistory } from '@/types'
import { cn } from '@/lib/utils'

export type LeadDetailContentProps = {
  lead: {
    id: string
    first_name: string | null
    last_name: string | null
    status: string
    phone: string | null
    email: string | null
    street: string | null
    zip: string | null
    city: string | null
    source: string | null
    product: string | null
    power_consumption?: number | null
    gas_consumption?: number | null
    notes?: string | null
    created_at: string
    is_on_hold?: boolean | null
    hold_notes?: string | null
    assigned_user?: { full_name?: string | null; email?: string | null } | null
    campaign?: { name?: string | null } | null
  }
  viewerRole: 'admin' | 'seller' | 'super_admin' | string
  viewerId: string
  cancellation?: any
  listHref: string
  lastContactAt: string | null
  attemptsCount: number
  openCallbacks: Callback[]
  openCallbacksCount: number
  openCallbackOverdue: boolean
  nextCallbackAt: string | null
  leadAge: number | null
  leadAgeClass: string
  contactAttempts: ContactAttempt[]
  statusHistory: LeadStatusHistory[]
  callbacks: Callback[]
  tags: Tag[]
  documents: LeadDocument[]
}

export function LeadDetailContent(props: LeadDetailContentProps) {
  const {
    lead,
    viewerRole,
    cancellation,
    lastContactAt,
    attemptsCount,
    openCallbacks,
    openCallbacksCount,
    openCallbackOverdue,
    nextCallbackAt,
    leadAge,
    leadAgeClass,
    contactAttempts,
    statusHistory,
    callbacks,
    tags,
    documents,
  } = props

  return (
    <>
      <div className="space-y-4 pb-48">
        {/* 1) Pipeline */}
        <LeadPipeline status={lead.status as LeadStatus} />

        {/* 2) Scorecard (volle Breite) */}
        <LeadScorecard
        lastContactAt={lastContactAt}
        attemptsCount={attemptsCount}
        openCallbacksCount={openCallbacksCount}
        leadAge={leadAge}
        leadAgeClass={leadAgeClass}
        openCallbackOverdue={openCallbackOverdue}
        nextCallbackAt={nextCallbackAt}
        totalTalkTimeSeconds={
          contactAttempts.reduce(
            (sum, a) => sum + (typeof a.call_duration_seconds === 'number' ? a.call_duration_seconds : 0),
            0,
          ) || null
        }
      />

      {/* 3) Haupt-Grid: Tabs-Card (links) + Sidebar (rechts sticky) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ==== LINKE SPALTE: TABS-CARD ==== */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200 bg-white shadow-sm overflow-visible">
            <Tabs defaultValue="overview" className="w-full">
              {/* ===== TABS-LEISTE (sticky, direkt unter globalem Header) ===== */}
              <div className="sticky top-[57px] z-30 border-b border-slate-100 bg-gradient-to-r from-slate-50/95 via-white to-slate-50/95 px-3 sm:px-4 py-2.5 backdrop-blur-md supports-[backdrop-filter]:bg-white/90 shadow-[0_1px_0_rgba(15,23,42,0.04)] rounded-t-lg">
                <TabsList className="h-9 w-full gap-0.5 justify-start bg-slate-100/80 p-0.5">
                  <TabsTrigger
                    value="overview"
                    className="h-7 px-2.5 sm:px-3 text-[11px] font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
                  >
                    <UserCircle className="mr-1 h-3 w-3" />
                    <span className="hidden sm:inline">Kontakt</span>
                    <span className="sm:hidden">Info</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="notes"
                    className="h-7 px-2.5 sm:px-3 text-[11px] font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Notizen
                  </TabsTrigger>
                  <TabsTrigger
                    value="actions"
                    className="h-7 px-2.5 sm:px-3 text-[11px] font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    Aktionen
                  </TabsTrigger>
                  <TabsTrigger
                    value="timeline"
                    className="h-7 px-2.5 sm:px-3 text-[11px] font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
                  >
                    <History className="mr-1 h-3 w-3" />
                    <span className="hidden sm:inline">Verlauf</span>
                    <span className="sm:hidden">Log</span>
                    <span className="ml-1 text-[9px] text-slate-400 tabular-nums">
                      ({contactAttempts.length + statusHistory.length + callbacks.length})
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="docs"
                    className="h-7 px-2.5 sm:px-3 text-[11px] font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
                  >
                    <FileTextIcon className="mr-1 h-3 w-3" />
                    <span className="hidden sm:inline">Dokumente</span>
                    <span className="sm:hidden">Dateien</span>
                    {documents.length > 0 && (
                      <span className="ml-1 text-[9px] text-slate-400 tabular-nums">
                        ({documents.length})
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ===== TAB 1: KONTAKT / ÜBERSICHT ===== */}
              <TabsContent value="overview" className="mt-0 p-4 sm:p-5 space-y-5 data-[state=inactive]:hidden">
                {/* Kontaktmöglichkeiten */}
                <div className="space-y-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> Kontaktmöglichkeiten
                  </h3>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-3.5">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Telefon</div>
                        <div className="mt-0.5 flex items-center gap-2">
                          {lead.phone ? (
                            <>
                              <a
                                href={phoneHref(lead.phone)}
                                className="font-semibold text-slate-900 hover:underline text-sm tabular-nums"
                              >
                                {formatPhone(lead.phone)}
                              </a>
                              <CopyButton text={lead.phone} size="sm" ariaLabel="Telefon kopieren" />
                            </>
                          ) : (
                            <span className="text-slate-400 text-sm">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-3.5">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-medium uppercase tracking-widest text-slate-400">E-Mail</div>
                        <div className="mt-0.5 flex items-center gap-2 min-w-0">
                          {lead.email ? (
                            <>
                              <a
                                href={`mailto:${lead.email}`}
                                className="font-semibold text-slate-900 hover:underline text-sm truncate"
                              >
                                {lead.email}
                              </a>
                              <CopyButton text={lead.email} size="sm" ariaLabel="E-Mail kopieren" />
                            </>
                          ) : (
                            <span className="text-slate-400 text-sm">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sekundäre Infos (Adresse etc.) - default zugeklappt */}
                <SecondaryInfoCard lead={lead} campaign={lead.campaign ?? null} />

                {/* Tags - kompakt */}
                {tags.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <TagIcon className="h-3 w-3" /> Schlagworte
                      <span className="text-slate-300 font-normal normal-case tracking-normal">·</span>
                      <span className="text-slate-400 font-normal normal-case tracking-normal text-[10px] tabular-nums">
                        {tags.length}
                      </span>
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      <CompactTagsInline tags={tags as any} />
                    </div>
                  </div>
                )}

                {/* Offene Rückrufe */}
                {openCallbacksCount > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3" /> Offene Rückrufe
                      <span className="text-slate-300 font-normal normal-case tracking-normal">·</span>
                      <span className="text-slate-400 font-normal normal-case tracking-normal text-[10px] tabular-nums">
                        {openCallbacksCount}
                      </span>
                    </h3>
                    <div className="space-y-1.5">
                      {openCallbacks.slice(0, 3).map((c: any) => {
                        const ueber = new Date(c.callback_at).getTime() < Date.now()
                        return (
                          <div
                            key={c.id}
                            className={cn(
                              'flex items-start justify-between gap-2 rounded-xl border p-3',
                              ueber
                                ? 'border-red-200 bg-red-50/40 urgent-pulse'
                                : 'border-amber-200/60 bg-amber-50/40',
                            )}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <CalendarDays
                                className={cn(
                                  'mt-0.5 h-4 w-4 shrink-0',
                                  ueber ? 'text-red-500' : 'text-amber-500',
                                )}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 tabular-nums">
                                  {formatDateShort(c.callback_at)} · {formatTime(c.callback_at)}
                                </div>
                                {ueber && (
                                  <div className="text-[10px] font-semibold text-red-600 mt-0.5">Überfällig</div>
                                )}
                                {c.notes && (
                                  <div className="mt-0.5 text-xs text-slate-600 truncate">{c.notes}</div>
                                )}
                              </div>
                            </div>
                            <CallbackQuickActions
                              callbackId={c.id}
                              leadId={lead.id}
                              status={c.status}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ===== TAB 2: NOTIZEN ===== */}
              <TabsContent value="notes" className="mt-0 p-4 sm:p-5 data-[state=inactive]:hidden">
                <NotesFormCard initialNotes={lead.notes ?? ''} leadId={lead.id} />
              </TabsContent>

              {/* ===== TAB 3: AKTIONEN ===== */}
              <TabsContent value="actions" className="mt-0 p-4 sm:p-5 space-y-4 data-[state=inactive]:hidden">
                <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                  <StatusFormCard initialStatus={lead.status as LeadStatus} leadId={lead.id} />
                </div>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                    <ContactAttemptForm leadId={lead.id} />
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                    <CallbackForm leadId={lead.id} />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-gradient-to-r from-slate-50 to-white p-4">
                  <h4 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                    <Layers className="h-3 w-3" /> Vollständige Tags-Verwaltung
                  </h4>
                  <LeadTagsPanel leadId={lead.id} tags={tags as any} />
                </div>
              </TabsContent>

              {/* ===== TAB 4: VERLAUF ===== */}
              <TabsContent value="timeline" className="mt-0 p-4 sm:p-5 data-[state=inactive]:hidden">
                <TimelineWithFilter
                  attempts={contactAttempts as any}
                  statusChanges={statusHistory as any}
                  callbacks={callbacks as any}
                />
              </TabsContent>

              {/* ===== TAB 5: DOKUMENTE ===== */}
              <TabsContent value="docs" className="mt-0 p-4 sm:p-5 data-[state=inactive]:hidden">
                <LeadDocumentsPanel leadId={lead.id} documents={documents as any} />
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* ==== RECHTE SPALTE: STICKY SIDEBAR ==== */}
        <div className="space-y-4 lg:sticky lg:top-[64px] self-start">
          <NextStepPanel
            openCallbacks={callbacks as any}
            attemptsCount={attemptsCount}
            lastContactAt={lastContactAt}
            leadAge={leadAge}
            status={lead.status as LeadStatus}
          />
          {(viewerRole === 'seller' || (cancellation && viewerRole === 'admin')) && (
            <CancellationRequestCard
              leadId={lead.id}
              cancellation={cancellation}
              role={viewerRole}
            />
          )}
          {tags.length > 0 && <CompactTagsSidebar leadId={lead.id} tags={tags as any} />}
          <MiniTimelineSidebar
            attempts={contactAttempts as any}
            statusChanges={statusHistory as any}
            callbacks={callbacks as any}
            defaultLimit={3}
          />
          {statusHistory.length > 0 && (
            <CompactStatusHistory history={statusHistory as any} defaultLimit={2} />
          )}
        </div>
      </div>
      </div>

      {/* ===== STICKY ACTION BAR (unten, sibling außerhalb aller Grid/Containment, damit fixed-bottom auf viewport geht) ===== */}
      <LeadActionBar
        leadId={lead.id}
        phone={lead.phone ?? null}
        email={lead.email ?? null}
        name={`${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || null}
      />
    </>
  )
}

export default LeadDetailContent
