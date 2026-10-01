import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getLeadWithDetails } from '@/lib/services/leads.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LeadStatusBadge, CallbackStatusBadge, ContactResultPill } from '@/components/ui-custom/StatusBadges'
import { LeadAvatar } from '@/components/ui-custom/LeadAvatar'
import { CopyButton } from '@/components/ui-custom/CopyButton'
import { CollapsibleCard } from '@/components/ui-custom/CollapsibleCard'
import {
  StatusFormCard,
  NotesFormCard,
  ContactAttemptForm,
  CallbackForm,
  CallbackQuickActions,
} from './LeadClientForms'
import {
  LeadActionBar,
  LeadTagsPanel,
  LeadDocumentsPanel,
  TimelineWithFilter,
  LeadSummaryBar,
} from './LeadDetailClient'
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Zap,
  Layers,
  UserCircle,
  Calendar,
  Clock,
  CalendarDays,
  Tag as TagIcon,
  FileText,
} from 'lucide-react'
import {
  LEAD_STATUS_LABELS,
  PRODUCT_LABELS,
  SOURCE_LABELS,
  formatDate,
  formatDateShort,
  formatTime,
  formatPhone,
  phoneHref,
  formatDaysSince,
  leadAgeClass,
} from '@/lib/constants'
import type { LeadStatus, LeadWithDetails, Tag, LeadDocument, Callback, ContactAttempt, LeadStatusHistory } from '@/types'
import { cn } from '@/lib/utils'

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const viewer = await requireUser()
  const lead = (await getLeadWithDetails(params.id, viewer.id, viewer.role)) as LeadWithDetails | null
  if (!lead) notFound()

  const assignedUser: any = (lead as any).assigned_user
  const campaign: any = (lead as any).campaign
  const callbacks: Callback[] = ((lead as any).callbacks ?? []) as any[]
  const contactAttempts: ContactAttempt[] = ((lead as any).contact_attempts ?? []) as any[]
  const statusHistory: LeadStatusHistory[] = ((lead as any).status_history ?? []) as any[]
  const tags: Tag[] = (lead as any).tags ?? []
  const documents: LeadDocument[] = (lead as any).documents ?? []

  // Summary berechnen (#56)
  const sortedAttempts = [...contactAttempts].sort(
    (a, b) => new Date(b.attempt_date).getTime() - new Date(a.attempt_date).getTime(),
  )
  const lastContactAt = sortedAttempts[0]?.attempt_date ?? null
  const attemptsCount = contactAttempts.length
  const callbacksCount = callbacks.filter((c: any) => c.status === 'offen').length
  const leadAge = formatDaysSince(lead.created_at)

  const breadcrumb =
    viewer.role === 'admin'
      ? [
          { label: 'Admin', href: '/admin/leads' },
          { label: 'Leads', href: '/admin/leads' },
          { label: `${lead.first_name} ${lead.last_name}` },
        ]
      : [
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Meine Leads', href: '/my-leads' },
          { label: `${lead.first_name} ${lead.last_name}` },
        ]

  return (
    <div className="space-y-6 pb-32">
      {/* Lead-Kopf */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <LeadAvatar firstName={lead.first_name} lastName={lead.last_name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  {lead.first_name} {lead.last_name}
                </h1>
                <LeadStatusBadge status={lead.status as LeadStatus} />
                {(lead as any).is_on_hold ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    <Clock className="h-3 w-3" /> Hold
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>ID: {lead.id.slice(0, 8)}…</span>
                <span>·</span>
                <span>erstellt {formatDate(lead.created_at)}</span>
                {assignedUser && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <UserCircle className="h-3.5 w-3.5" />
                      {assignedUser.full_name ?? assignedUser.email}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Summary (#56) */}
          <LeadSummaryBar
            lastContactAt={lastContactAt}
            attemptsCount={attemptsCount}
            openCallbacksCount={callbacksCount}
            leadAge={leadAge}
            leadAgeClass={leadAgeClass(leadAge)}
          />
        </div>
        <Link
          href={viewer.role === 'admin' ? '/admin/leads' : '/my-leads'}
          className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zur Liste
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Linke Spalte */}
        <div className="space-y-6 lg:col-span-2">
          {/* Kontaktinformationen */}
          <Card className="card-hoverable border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
                  <UserCircle className="h-4 w-4 text-slate-400" />
                  Kontaktinformationen
                </CardTitle>
                <div className="text-xs text-slate-500 pt-0.5">Stammdaten des Leads</div>
              </div>
              <div className="flex items-center gap-2">
                {lead.phone ? (
                  <a
                    href={phoneHref(lead.phone)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Phone className="mr-0.5 h-4 w-4" />
                    Anrufen
                  </a>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoRow icon={<Phone className="h-4 w-4 text-slate-400" />} label="Telefon">
                  <div className="flex items-center gap-2">
                    <a href={phoneHref(lead.phone)} className="font-medium text-slate-900 hover:underline">
                      {lead.phone ? formatPhone(lead.phone) : '–'}
                    </a>
                    {lead.phone ? <CopyButton text={lead.phone} size="sm" ariaLabel="Telefon kopieren" /> : null}
                  </div>
                </InfoRow>
                <InfoRow icon={<Mail className="h-4 w-4 text-slate-400" />} label="E-Mail">
                  <div className="flex items-center gap-2 min-w-0">
                    {lead.email ? (
                      <>
                        <a href={`mailto:${lead.email}`} className="font-medium text-slate-900 hover:underline truncate">
                          {lead.email}
                        </a>
                        <CopyButton text={lead.email} size="sm" ariaLabel="E-Mail kopieren" />
                      </>
                    ) : (
                      <span className="text-slate-400">–</span>
                    )}
                  </div>
                </InfoRow>
                <InfoRow icon={<MapPin className="h-4 w-4 text-slate-400" />} label="Adresse">
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div>
                      <div className="text-slate-800">{lead.street ?? '–'}</div>
                      <div className="text-slate-500 text-xs">
                        {[lead.zip, lead.city].filter(Boolean).join(' ') || '–'}
                      </div>
                    </div>
                    {lead.street ? (
                      <CopyButton
                        text={`${lead.street ?? ''}, ${[lead.zip, lead.city].filter(Boolean).join(' ')}`.trim()}
                        size="sm"
                        ariaLabel="Adresse kopieren"
                      />
                    ) : null}
                  </div>
                </InfoRow>
                <InfoRow icon={<UserCircle className="h-4 w-4 text-slate-400" />} label="Quelle / Kampagne">
                  <div>
                    <div className="text-slate-800">{SOURCE_LABELS[lead.source as keyof typeof SOURCE_LABELS] ?? lead.source}</div>
                    <div className="text-xs text-slate-500">{campaign?.name ?? 'Keine Kampagne'}</div>
                  </div>
                </InfoRow>
                <InfoRow icon={<Zap className="h-4 w-4 text-slate-400" />} label="Produkt">
                  <div>
                    <div className="text-slate-800">{PRODUCT_LABELS[lead.product as keyof typeof PRODUCT_LABELS]}</div>
                    <div className="text-xs text-slate-500">
                      {(lead as any).power_consumption ? `Strom: ${(lead as any).power_consumption.toLocaleString('de-DE')} kWh` : ''}
                      {(lead as any).power_consumption && (lead as any).gas_consumption ? ' · ' : ''}
                      {(lead as any).gas_consumption ? `Gas: ${(lead as any).gas_consumption.toLocaleString('de-DE')} kWh` : ''}
                      {!(lead as any).power_consumption && !(lead as any).gas_consumption ? 'Keine Verbrauchswerte' : ''}
                    </div>
                  </div>
                </InfoRow>
                <InfoRow icon={<Calendar className="h-4 w-4 text-slate-400" />} label="Status">
                  <div className="flex items-center gap-2">
                    <LeadStatusBadge status={lead.status as LeadStatus} />
                    {(lead as any).is_on_hold && (lead as any).hold_notes ? (
                      <span className="text-[11px] text-slate-500">· {(lead as any).hold_notes}</span>
                    ) : null}
                  </div>
                </InfoRow>
              </div>
            </CardContent>
          </Card>

          {/* Tags (#51) */}
          <CollapsibleCard
            id="lead-detail-tags"
            defaultOpen
            title={
              <span className="inline-flex items-center gap-2">
                <TagIcon className="h-4 w-4 text-slate-400" />
                Schlagworte & Tags
              </span>
            }
            subtitle="Interne Klassifizierungen für die Lead-Arbeit"
          >
            <LeadTagsPanel leadId={lead.id} tags={tags as any} />
          </CollapsibleCard>

          {/* Dokumente (#46) */}
          <CollapsibleCard
            id="lead-detail-documents"
            defaultOpen
            title={
              <span className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                Dokumente & Uploads
              </span>
            }
            subtitle="Relevante Dateien, Verträge, Notizen (Upload als Datenbank-Eintrag)"
          >
            <LeadDocumentsPanel leadId={lead.id} documents={documents as any} />
          </CollapsibleCard>

          {/* Status + Notizen */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="card-hoverable border-slate-200 bg-white shadow-sm">
              <StatusFormCard initialStatus={lead.status as LeadStatus} leadId={lead.id} />
            </Card>
            <Card className="card-hoverable border-slate-200 bg-white shadow-sm">
              <NotesFormCard initialNotes={lead.notes ?? ''} leadId={lead.id} />
            </Card>
          </div>

          {/* Kontaktversuch + Rückruf */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="card-hoverable border-slate-200 bg-white shadow-sm">
              <ContactAttemptForm leadId={lead.id} />
            </Card>
            <Card className="card-hoverable border-slate-200 bg-white shadow-sm">
              <CallbackForm leadId={lead.id} />
            </Card>
          </div>

          {/* Timeline mit Filter (#52) */}
          <Card className="card-hoverable border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  Kontaktversuche & Verlauf
                </CardTitle>
                <div className="text-xs text-slate-500 pt-0.5">Alle bisherigen Interaktionen</div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <TimelineWithFilter
                attempts={contactAttempts as any}
                statusChanges={statusHistory as any}
                callbacks={callbacks as any}
              />
            </CardContent>
          </Card>
        </div>

        {/* Rechte Spalte */}
        <div className="space-y-6">
          <Card className="card-hoverable border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                Anstehende Rückrufe
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {(() => {
                const openCbs = callbacks
                  .filter((c: any) => c.status === 'offen')
                  .sort((a, b) => new Date(a.callback_at).getTime() - new Date(b.callback_at).getTime())
                if (openCbs.length === 0) {
                  return (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                      Keine offenen Rückrufe für diesen Lead.
                    </div>
                  )
                }
                return openCbs.map((c: any) => {
                  const ueber = new Date(c.callback_at).getTime() < Date.now()
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        'rounded-lg border border-slate-100 bg-slate-50/60 p-3',
                        ueber ? 'urgent-pulse' : '',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                            <CalendarDays
                              className={cn('h-4 w-4', ueber ? 'text-red-500' : 'text-amber-500')}
                            />
                            {formatDateShort(c.callback_at)} · {formatTime(c.callback_at)}
                          </div>
                          {ueber && <div className="text-xs font-medium text-red-600 mt-0.5">überfällig</div>}
                          {c.notes && <div className="mt-1 text-xs text-slate-500">{c.notes}</div>}
                        </div>
                        <CallbackQuickActions callbackId={c.id} leadId={lead.id} status={c.status} />
                      </div>
                    </div>
                  )
                })
              })()}
            </CardContent>
          </Card>

          <Card className="card-hoverable border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-400" />
                Status-Historie
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {statusHistory
                .slice()
                .sort((a, b) => new Date((b as any).created_at).getTime() - new Date((a as any).created_at).getTime())
                .map((h: any) => (
                  <div
                    key={h.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/40 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                        <Layers className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-sm">
                          {h.old_status ? (
                            <>
                              <span className="text-xs text-slate-500">
                                {LEAD_STATUS_LABELS[h.old_status as LeadStatus]}
                              </span>
                              <span className="text-slate-300">→</span>
                            </>
                          ) : null}
                          <LeadStatusBadge status={h.new_status} />
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {h.user?.full_name ?? 'System'} · {formatDate(h.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              {statusHistory.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                  Noch keine Status-Änderungen.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky Action Bar (#44) */}
      <LeadActionBar
        leadId={lead.id}
        phone={lead.phone ?? null}
        email={lead.email ?? null}
      />
    </div>
  )
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/40 p-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="mt-0.5 text-sm">{children}</div>
      </div>
    </div>
  )
}
