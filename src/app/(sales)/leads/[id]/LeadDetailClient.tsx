'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFormState } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  CalendarDays,
  Layers,
  Tag as TagIcon,
  Plus,
  X,
  Trash2,
  FileText,
  Upload,
  CheckCircle2,
  Filter,
  ArrowUpRight,
  History,
  Calendar,
  PhoneCall,
  PhoneOff,
  ThumbsDown,
  ChevronRight,
  Sparkles,
  PhoneForwarded,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  UserCircle,
} from 'lucide-react'
import {
  assignTagToLeadAction,
  removeTagFromLeadAction,
  createTagAction,
  addLeadDocumentAction,
  deleteLeadDocumentAction,
  updateLeadStatusAction,
  addContactAttemptAction,
} from '@/app/actions'
import { SubmitButton, useActionFeedback, type ActionResult } from '@/components/ui-custom/FormHelpers'
import { LeadStatusBadge, ContactResultPill, CallbackStatusBadge } from '@/components/ui-custom/StatusBadges'
import { CollapsibleCard } from '@/components/ui-custom/CollapsibleCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { CopyButton } from '@/components/ui-custom/CopyButton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  LEAD_STATUS_LABELS,
  CONTACT_RESULT_LABELS,
  SOURCE_LABELS,
  PRODUCT_LABELS,
  formatDate,
  formatDateShort,
  formatTime,
  formatBytes,
  phoneHref,
  formatDaysSince,
  formatCallDuration,
  formatCallDurationLong,
} from '@/lib/constants'
import type { LeadStatus, Tag, LeadDocument, ContactAttempt, LeadStatusHistory, Callback } from '@/types'
import { cn } from '@/lib/utils'

/* =========================================================
   #56 - Lead Summary Bar
   ========================================================= */

export function LeadSummaryBar({
  lastContactAt,
  attemptsCount,
  openCallbacksCount,
  leadAge,
  leadAgeClass,
}: {
  lastContactAt: string | null
  attemptsCount: number
  openCallbacksCount: number
  leadAge: number | null
  leadAgeClass: string
}) {
  const lastDays = lastContactAt ? formatDaysSince(lastContactAt) : null
  const lastText = lastDays === null ? '—' : lastDays === 0 ? 'Heute' : `vor ${lastDays} T.`
  const ageText = leadAge === null ? '—' : leadAge === 0 ? 'Heute' : `${leadAge} T.`

  const items = [
    {
      label: 'Letzter Kontakt',
      value: lastText,
      hint: attemptsCount > 0 ? `${attemptsCount} Versuch${attemptsCount === 1 ? '' : 'e'}` : 'Noch kein Kontakt',
      color: lastDays === null ? '' : lastDays <= 3 ? 'text-emerald-600' : lastDays <= 7 ? 'text-amber-600' : 'text-red-600',
      icon: <Clock className="h-3.5 w-3.5" />,
    },
    {
      label: 'Kontaktversuche',
      value: String(attemptsCount),
      hint: 'Gesamtanzahl',
      color: '',
      icon: <Phone className="h-3.5 w-3.5" />,
    },
    {
      label: 'Offene Rückrufe',
      value: String(openCallbacksCount),
      hint: openCallbacksCount > 0 ? `${openCallbacksCount} geplant` : 'Keine geplant',
      color: openCallbacksCount > 0 ? 'text-amber-600' : '',
      icon: <CalendarDays className="h-3.5 w-3.5" />,
    },
    {
      label: 'Lead-Alter',
      value: ageText,
      hint: 'seit Erstellung',
      color: leadAgeClass,
      icon: <History className="h-3.5 w-3.5" />,
    },
  ]

  return (
    <div className="sticky top-[57px] z-30 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white/85 p-3 backdrop-blur shadow-sm sm:grid-cols-4 sm:gap-3 sm:p-4 mt-2 max-w-3xl animate-in fade-in slide-in-from-top-2">
      {items.map((it, i) => (
        <div key={i} className="flex flex-col rounded-xl border border-slate-100 bg-white p-2.5 sm:p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
            {it.icon}
            <span>{it.label}</span>
          </div>
          <div className={cn('mt-1 text-lg font-semibold tabular-nums leading-tight', it.color)}>
            {it.value}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500 truncate">{it.hint}</div>
        </div>
      ))}
    </div>
  )
}

/* =========================================================
   LeadActionBar: Icon-only Buttons + Call-Quick-Overlay + Nächster-Lead
   ========================================================= */

function ActionButton({
  label,
  children,
  onClick,
  href,
  asChild,
  variant = 'ghost',
}: {
  label: string
  children: React.ReactNode
  onClick?: () => void
  href?: string
  asChild?: boolean
  variant?: 'ghost' | 'primary' | 'brand'
}) {
  const cls =
    variant === 'primary'
      ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm border border-slate-900'
      : variant === 'brand'
        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm border border-emerald-600'
        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 border'
  const inner = (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        {href ? (
          <a
            href={href}
            onClick={onClick}
            className={
              'inline-flex min-h-[40px] w-10 items-center justify-center rounded-lg text-sm transition ' +
              cls
            }
            aria-label={label}
            title={label}
          >
            {children}
          </a>
        ) : (
          <button
            type="button"
            onClick={onClick}
            className={
              'inline-flex min-h-[40px] w-10 items-center justify-center rounded-lg text-sm transition ' +
              cls
            }
            aria-label={label}
            title={label}
          >
            {children}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        <span className="text-[11px] font-medium">{label}</span>
      </TooltipContent>
    </Tooltip>
  )
  return inner
}

/* ============ Call-Quick-Overlay (Punkt 26) + Live Timer (Punkt 35) ============ */
function CallQuickOverlay({
  open,
  onClose,
  leadId,
  name,
  phone,
}: {
  open: boolean
  onClose: () => void
  leadId: string
  name: string
  phone: string | null
}) {
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!open) return
    setCallStartedAt(null)
    setElapsed(0)
  }, [open])

  useEffect(() => {
    if (callStartedAt === null) return
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - callStartedAt) / 1000))
    }, 250)
    return () => window.clearInterval(id)
  }, [callStartedAt])

  function startCallTimer() {
    if (callStartedAt === null) setCallStartedAt(Date.now())
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <div
      aria-hidden={!open}
      className={cn(
        'fixed bottom-[64px] left-1/2 z-[998] w-[94vw] max-w-md -translate-x-1/2 transition-all duration-300 sm:bottom-[68px]',
        open
          ? 'opacity-100 translate-y-0 visible pointer-events-auto'
          : 'opacity-0 translate-y-4 invisible pointer-events-none',
      )}
    >
      <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_18px_60px_-20px_rgba(15,23,42,0.35)] p-3 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between gap-2 mb-2.5 px-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn(
              'relative flex h-8 w-8 items-center justify-center rounded-full border shrink-0 transition-colors',
              callStartedAt !== null
                ? 'bg-emerald-500 text-white border-emerald-600 animate-pulse'
                : 'bg-emerald-100 text-emerald-700 border-emerald-200',
            )}>
              <PhoneCall className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-slate-900 truncate">{name || 'Lead'}</div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                {phone ?? 'Keine Telefonnummer'}
                {callStartedAt !== null && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="tabular-nums font-medium text-emerald-600 flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-dot" />
                      {mm}:{ss}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0"
            aria-label="Overlay schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <QuickResultBtn
            leadId={leadId}
            result="erreicht"
            label="Erreicht"
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="emerald"
            onSuccess={onClose}
            callSeconds={elapsed > 0 ? elapsed : undefined}
          />
          <QuickResultBtn
            leadId={leadId}
            result="besetzt"
            label="Besetzt"
            icon={<PhoneOff className="h-4 w-4" />}
            tone="amber"
            onSuccess={onClose}
            callSeconds={elapsed > 0 ? elapsed : undefined}
          />
          <QuickResultBtn
            leadId={leadId}
            result="rückruf"
            label="Rückruf"
            icon={<PhoneForwarded className="h-4 w-4" />}
            tone="blue"
            onSuccess={onClose}
            callSeconds={elapsed > 0 ? elapsed : undefined}
          />
          <QuickResultBtn
            leadId={leadId}
            result="kein_interesse"
            label="Kein Interesse"
            icon={<ThumbsDown className="h-4 w-4" />}
            tone="rose"
            onSuccess={onClose}
            callSeconds={elapsed > 0 ? elapsed : undefined}
          />
        </div>
        {phone ? (
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 px-1">
            <div className="text-[11px] text-slate-500">
              {callStartedAt === null ? 'Nummer direkt anrufen (Timer startet automatisch)' : 'Anruf läuft – Ergebnis oben wählen'}
            </div>
            <a
              href={phoneHref(phone)}
              onClick={startCallTimer}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[11px] font-semibold text-white hover:bg-emerald-700 transition shadow-sm"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              {callStartedAt === null ? 'Anrufen' : 'Weiter telefonieren'}
            </a>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function QuickResultBtn({
  leadId,
  result,
  label,
  icon,
  tone,
  onSuccess,
  callSeconds,
}: {
  leadId: string
  result: 'erreicht' | 'besetzt' | 'rückruf' | 'kein_interesse'
  label: string
  icon: React.ReactNode
  tone: 'emerald' | 'amber' | 'blue' | 'rose'
  onSuccess: () => void
  callSeconds?: number
}) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(async (_, fd) => {
    if (callSeconds && callSeconds > 0) {
      const mm = String(Math.floor(callSeconds / 60)).padStart(2, '0')
      const ss = String(callSeconds % 60).padStart(2, '0')
      const existingNotes = String(fd.get('notes') ?? '')
      const autoNote = `[Anruf: ${mm}:${ss} Dauer per Quick-Overlay]`
      fd.set('notes', existingNotes ? `${autoNote}\n${existingNotes}` : autoNote)
      fd.set('call_duration_seconds', String(callSeconds))
    }
    const res = (await addContactAttemptAction(fd)) as any
    if (res?.ok) onSuccess()
    return res
  }, null)
  useActionFeedback(state)

  const toneCls = {
    emerald:
      'border-emerald-200 text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 data-[pending=true]:bg-emerald-100',
    amber:
      'border-amber-200 text-amber-700 hover:bg-amber-50 active:bg-amber-100 data-[pending=true]:bg-amber-100',
    blue: 'border-sky-200 text-sky-700 hover:bg-sky-50 active:bg-sky-100 data-[pending=true]:bg-sky-100',
    rose: 'border-rose-200 text-rose-700 hover:bg-rose-50 active:bg-rose-100 data-[pending=true]:bg-rose-100',
  }[tone]

  return (
    <form action={formAction} className="m-0">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="result" value={result} />
      <SubmitButton
        variant="outline"
        size="sm"
        className={'w-full h-auto !py-2.5 flex-col !px-0 !gap-1 border ' + toneCls}
        pendingLabel="…"
      >
        <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
        <span className="text-[10px] font-semibold leading-tight">{label}</span>
        {callSeconds && callSeconds > 0 ? (
          <span className="text-[9px] tabular-nums opacity-80 leading-tight">
            {String(Math.floor(callSeconds / 60)).padStart(2, '0')}:{String(callSeconds % 60).padStart(2, '0')}
          </span>
        ) : null}
      </SubmitButton>
    </form>
  )
}

/* ============ Nächster Lead Button (Punkt 27) ============ */
function NextLeadButton({ currentId }: { currentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function goNext() {
    try {
      setLoading(true)
      const res = await fetch(`/api/leads/next?skip=${encodeURIComponent(currentId)}`)
      if (!res.ok) {
        router.push('/my-leads')
        return
      }
      const data = await res.json()
      const nextId: string | undefined = data?.id
      if (!nextId) {
        router.push('/my-leads')
        return
      }
      router.push(`/leads/${nextId}`)
    } catch {
      router.push('/my-leads')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={goNext}
          disabled={loading}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-gradient-to-br from-sky-600 to-indigo-600 px-3 text-xs font-semibold text-white shadow-sm hover:from-sky-700 hover:to-indigo-700 disabled:opacity-60 transition"
          title="Nächsten offenen Lead öffnen"
        >
          {loading ? (
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white/60 border-t-white animate-spin" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Nächster Lead</span>
          <ChevronRight className="hidden sm:block h-3.5 w-3.5 -ml-1" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        <span className="text-[11px] font-medium">Nächsten offenen Lead öffnen</span>
      </TooltipContent>
    </Tooltip>
  )
}

/* ============ Haupt-Komponente LeadActionBar ============ */
export function LeadActionBar({
  leadId,
  phone,
  email,
  name,
}: {
  leadId: string
  phone: string | null
  email: string | null
  name?: string | null
}) {
  const [callOpen, setCallOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const barNode = typeof document !== 'undefined' ? document.body : null
  const barStyle = {
    position: 'fixed' as const,
    top: 'auto' as const,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 999,
    width: '100%',
  }

  return (
    <>
      {mounted && barNode
        ? createPortal(
            <>
              <div
                className="fixed z-[999] w-full border-t border-slate-200 bg-white/98 backdrop-blur-xl shadow-[0_-10px_40px_-10px_rgba(15,23,42,0.2)] pb-[env(safe-area-inset-bottom,0px)]"
                style={barStyle}
              >
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="hidden text-[10px] font-semibold uppercase tracking-widest text-slate-400 sm:inline">
                      Schnellaktionen
                    </span>
                  </div>
                  <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {phone ? (
                      <ActionButton label="Lead anrufen + Schnellauswertung" onClick={() => setCallOpen(true)} variant="brand">
                        <PhoneCall className="h-4 w-4" />
                      </ActionButton>
                    ) : null}
                    {email ? (
                      <ActionButton label="E-Mail schreiben" href={`mailto:${email}`}>
                        <Mail className="h-4 w-4" />
                      </ActionButton>
                    ) : null}
                    {phone ? (
                      <CopyButton text={phone} ariaLabel="Telefonnummer kopieren" size="sm" className="h-10 w-10 !p-0">
                        <span className="inline-flex items-center justify-center w-full h-full">
                          <Phone className="h-3.5 w-3.5" />
                        </span>
                      </CopyButton>
                    ) : null}
                    <QuickStatusSelect leadId={leadId} />
                    <NextLeadButton currentId={leadId} />
                    <ActionButton label="Leads-Liste öffnen" href="/my-leads" variant="primary">
                      <ArrowUpRight className="h-4 w-4" />
                    </ActionButton>
                  </div>
                </div>
              </div>

              <CallQuickOverlay
                open={callOpen}
                onClose={() => setCallOpen(false)}
                leadId={leadId}
                name={name ?? ''}
                phone={phone}
              />
            </>,
            barNode,
          )
        : null}
    </>
  )
}

/* Small helper for quick status change inside bar */
function QuickStatusSelect({ leadId }: { leadId: string }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await updateLeadStatusAction(fd)) as any,
    null,
  )
  useActionFeedback(state)
  const statuses: LeadStatus[] = [
    'new',
    'assigned',
    'contacted',
    'callback',
    'offer',
    'closed',
    'no_interest',
    'wrong_data',
    'canceled',
  ]
  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="leadId" value={leadId} />
      <Select name="status">
        <SelectTrigger className="h-10 min-w-[120px] sm:min-w-[140px] border-slate-200 bg-white text-xs sm:text-sm">
          <SelectValue placeholder="Status setzen…" />
        </SelectTrigger>
        <SelectContent>
          {statuses.map((s) => (
            <SelectItem key={s} value={s} className="text-xs">
              {LEAD_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SubmitButton size="sm" variant="outline" className="h-10 px-3 text-xs">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline ml-1">Speichern</span>
      </SubmitButton>
    </form>
  )
}

/* =========================================================
   #51 - Lead Tags Panel
   ========================================================= */

type TagLike = { id: string; name: string; color: string | null }

export function LeadTagsPanel({ leadId, tags }: { leadId: string; tags: TagLike[] }) {
  const assignedIds = useMemo(() => new Set(tags.map((t) => t.id)), [tags])
  const [availableTags, setAvailableTags] = useState<TagLike[] | null>(null)
  const [filterQ, setFilterQ] = useState('')

  function tagColorClass(c: string | null): string {
    if (c && /^#?[0-9a-f]{6}$/i.test(c)) {
      const hex = c.startsWith('#') ? c : `#${c}`
      return { backgroundColor: `${hex}20`, color: hex, borderColor: `${hex}40` } as any
    }
    return 'bg-slate-100 text-slate-700 border-slate-200'
  }

  async function loadAvailable() {
    try {
      const r = await fetch('/api/tags')
      if (r.ok) {
        const list = await r.json()
        setAvailableTags(Array.isArray(list) ? list : [])
      } else {
        setAvailableTags([])
      }
    } catch {
      setAvailableTags([])
    }
  }

  return (
    <div className="space-y-4">
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <TagChip key={t.id} tag={t} leadId={leadId} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          Noch keine Tags zugewiesen. Klicke auf „Tag hinzufügen“, um den Lead zu klassifizieren.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="h-9" onClick={loadAvailable}>
              <Plus className="h-3.5 w-3.5" />
              Tag hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Tag zuweisen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <AssignTagForm
                leadId={leadId}
                assignedIds={assignedIds}
                availableTags={availableTags}
                filterQ={filterQ}
                setFilterQ={setFilterQ}
              />
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-2">
                  Neuen Tag erstellen
                </p>
                <CreateTagForm />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

function TagChip({ tag, leadId }: { tag: TagLike; leadId: string }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await removeTagFromLeadAction(fd)) as any,
    null,
  )
  useActionFeedback(state)
  const style: any = typeof tag?.color === 'string' && /^#?[0-9a-f]{6}$/i.test(tag.color)
    ? {
        backgroundColor: `${tag.color.startsWith('#') ? tag.color : '#' + tag.color}20`,
        color: tag.color.startsWith('#') ? tag.color : '#' + tag.color,
        borderColor: `${tag.color.startsWith('#') ? tag.color : '#' + tag.color}40`,
      }
    : undefined

  return (
    <form action={formAction} className="group inline-flex">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="tagId" value={tag.id} />
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
          style ? '' : 'bg-slate-100 text-slate-700 border-slate-200',
        )}
        style={style}
      >
        <TagIcon className="h-3 w-3" />
        {tag.name}
        <button
          type="submit"
          aria-label={`Tag ${tag.name} entfernen`}
          className="ml-0.5 -mr-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full opacity-60 hover:opacity-100 hover:bg-black/10"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </span>
    </form>
  )
}

function AssignTagForm({
  leadId,
  assignedIds,
  availableTags,
  filterQ,
  setFilterQ,
}: {
  leadId: string
  assignedIds: Set<string>
  availableTags: TagLike[] | null
  filterQ: string
  setFilterQ: (s: string) => void
}) {
  const filtered = (availableTags ?? []).filter(
    (t) => !filterQ || t.name.toLowerCase().includes(filterQ.toLowerCase()),
  )

  if (availableTags === null) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 text-center">
        Tags werden geladen… (Hinweis: Ohne laufenden Server wird die Liste leer angezeigt)
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Suche nach Tags…"
          value={filterQ}
          onChange={(e) => setFilterQ(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>
      <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500">
            Keine passenden Tags gefunden.
          </div>
        ) : (
          filtered.map((t) => {
            const isAssigned = assignedIds.has(t.id)
            return (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <TagIcon className="h-3 w-3" />
                  {t.name}
                </span>
                {isAssigned ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Zugewiesen
                  </span>
                ) : (
                  <AssignTagButton leadId={leadId} tagId={t.id} />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function AssignTagButton({ leadId, tagId }: { leadId: string; tagId: string }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await assignTagToLeadAction(fd)) as any,
    null,
  )
  useActionFeedback(state)
  return (
    <form action={formAction}>
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="tagId" value={tagId} />
      <SubmitButton size="sm" variant="outline" className="h-7 px-2.5 text-[11px]">
        <Plus className="h-3 w-3" />
        Zuweisen
      </SubmitButton>
    </form>
  )
}

function CreateTagForm() {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await createTagAction(fd)) as any,
    null,
  )
  useActionFeedback(state)
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="space-y-1">
          <Label htmlFor="tag-name" className="text-[11px] uppercase tracking-widest text-slate-400">
            Name
          </Label>
          <Input id="tag-name" name="name" required placeholder="z. B. Premium-Kunde" className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tag-color" className="text-[11px] uppercase tracking-widest text-slate-400">
            Farbe
          </Label>
          <div className="flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-1.5">
            <Input
              id="tag-color"
              name="color"
              type="color"
              defaultValue="#6366f1"
              className="h-7 w-12 border-0 p-0 bg-transparent"
            />
          </div>
        </div>
      </div>
      {state?.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</div>
      ) : null}
      <div className="flex justify-end">
        <SubmitButton size="sm" className="h-9 px-4 text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          Tag erstellen
        </SubmitButton>
      </div>
    </form>
  )
}

/* =========================================================
   #46 - Lead Documents Panel
   ========================================================= */

type DocLike = { id: string; file_name: string; size_bytes: number | null; created_at: string }

export function LeadDocumentsPanel({ leadId, documents }: { leadId: string; documents: DocLike[] }) {
  return (
    <div className="space-y-4">
      <UploadDocumentForm leadId={leadId} />
      {documents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          Noch keine Dokumente vorhanden.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {documents.map((d) => (
            <DocumentRow key={d.id} leadId={leadId} doc={d} />
          ))}
        </ul>
      )}
    </div>
  )
}

function DocumentRow({ leadId, doc }: { leadId: string; doc: DocLike }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await deleteLeadDocumentAction(fd)) as any,
    null,
  )
  useActionFeedback(state)
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 card-hoverable">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 border border-blue-100">
          <FileText className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-slate-800">{doc.file_name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500 tabular-nums">
            <span>{formatDate(doc.created_at)}</span>
            {doc.size_bytes ? (
              <>
                <span className="text-slate-300">·</span>
                <span>{formatBytes(doc.size_bytes)}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <form action={formAction}>
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="docId" value={doc.id} />
        <button
          type="submit"
          aria-label="Dokument löschen"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </form>
    </li>
  )
}

function UploadDocumentForm({ leadId }: { leadId: string }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await addLeadDocumentAction(fd)) as any,
    null,
  )
  useActionFeedback(state)
  const [fileName, setFileName] = useState('')
  const [size, setSize] = useState(0)

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="file_name" value={fileName} />
        <input type="hidden" name="size" value={String(size)} />
        <div>
          <Label
            htmlFor={`doc-upload-${leadId}`}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-xs text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500 border border-slate-200">
              <Upload className="h-4 w-4" />
            </div>
            <div className="text-center">
              <div className="font-medium text-slate-700">
                {fileName ? fileName : 'Datei wählen oder hierher ziehen'}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                PDF, Bilder (PNG, JPG) · bis 10 MB
              </div>
            </div>
          </Label>
          <input
            id={`doc-upload-${leadId}`}
            name="file"
            type="file"
            accept="image/*,.pdf"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) {
                setFileName(f.name)
                setSize(f.size)
              }
            }}
          />
        </div>
        {state?.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</div>
        ) : null}
        <div className="flex items-center justify-between">
          <div className="text-[11px] text-slate-500 tabular-nums">
            {size > 0 ? `Datei: ${formatBytes(size)}` : 'Keine Datei gewählt'}
          </div>
          <div className="flex items-center gap-2">
            <SubmitButton size="sm" className="h-9 px-4 text-xs" disabled={!fileName}>
              <FileText className="h-3.5 w-3.5" />
              Hinzufügen
            </SubmitButton>
          </div>
        </div>
      </form>
    </div>
  )
}

/* =========================================================
   #52 - Timeline with Filter Tabs
   ========================================================= */

type AttemptLike = { attempt_date: string; result: string; notes?: string | null } & any
type StatusLike = { created_at: string; old_status?: string; new_status: string; user?: any } & any
type CallbackLike = { callback_at: string; status: string; notes?: string | null; created_at: string } & any

export function TimelineWithFilter({
  attempts,
  statusChanges,
  callbacks,
}: {
  attempts: AttemptLike[]
  statusChanges: StatusLike[]
  callbacks: CallbackLike[]
}) {
  const [tab, setTab] = useState<'all' | 'attempts' | 'status' | 'callbacks'>('all')

  const allEntries = useMemo(() => {
    type Entry = { at: string; kind: 'attempt' | 'status' | 'callback'; data: any }
    const list: Entry[] = []
    if (tab === 'all' || tab === 'attempts') {
      for (const a of attempts) list.push({ at: a.attempt_date, kind: 'attempt', data: a })
    }
    if (tab === 'all' || tab === 'status') {
      for (const s of statusChanges) list.push({ at: s.created_at, kind: 'status', data: s })
    }
    if (tab === 'all' || tab === 'callbacks') {
      for (const c of callbacks) list.push({ at: c.callback_at, kind: 'callback', data: c })
    }
    list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    return list
  }, [tab, attempts, statusChanges, callbacks])

  return (
    <div className="space-y-4">
      <Tabs defaultValue="all" value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="h-9 gap-0.5 bg-slate-100 p-0.5">
          <TabsTrigger value="all" className="h-7 px-3 text-[11px] font-medium data-[state=active]:bg-white">
            Alle
            <span className="ml-1.5 text-[10px] text-slate-400">
              ({attempts.length + statusChanges.length + callbacks.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="attempts" className="h-7 px-3 text-[11px] font-medium data-[state=active]:bg-white">
            <Phone className="mr-1 h-3 w-3" />
            Versuche
            <span className="ml-1.5 text-[10px] text-slate-400">({attempts.length})</span>
          </TabsTrigger>
          <TabsTrigger value="status" className="h-7 px-3 text-[11px] font-medium data-[state=active]:bg-white">
            <Layers className="mr-1 h-3 w-3" />
            Status
            <span className="ml-1.5 text-[10px] text-slate-400">({statusChanges.length})</span>
          </TabsTrigger>
          <TabsTrigger value="callbacks" className="h-7 px-3 text-[11px] font-medium data-[state=active]:bg-white">
            <Calendar className="mr-1 h-3 w-3" />
            Rückrufe
            <span className="ml-1.5 text-[10px] text-slate-400">({callbacks.length})</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {allEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-xs text-slate-500">
          Keine Einträge in dieser Ansicht.
        </div>
      ) : (
        <ul className="space-y-3">
          {allEntries.map((e, i) => (
            <li key={i} className="rounded-lg border border-slate-100 bg-slate-50/40 p-3 card-hoverable">
              {e.kind === 'attempt' && <AttemptNode a={e.data} />}
              {e.kind === 'status' && <StatusNode s={e.data} />}
              {e.kind === 'callback' && <CallbackNode c={e.data} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AttemptNode({ a }: { a: AttemptLike }) {
  const duration = a.call_duration_seconds ?? null
  const durShort = formatCallDuration(duration)
  const durLong = formatCallDurationLong(duration)
  return (
    <div className="flex items-start gap-3 w-full">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
          duration !== null
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-blue-200 bg-blue-50 text-blue-600',
        )}
      >
        <Phone className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-slate-900">Kontaktversuch</span>
          <ContactResultPill result={a.result} />
          {durShort ? (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 tabular-nums"
              title={durLong ?? undefined}
            >
              <Clock className="h-3 w-3" />
              {durShort}
            </span>
          ) : null}
          <span className="text-[11px] text-slate-500 tabular-nums ml-auto">
            {formatDate(a.attempt_date)} · {formatTime(a.attempt_date)}
          </span>
        </div>
        {durLong && (
          <div className="text-[10px] text-emerald-700 mt-0.5 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Gesprächszeit: <span className="font-semibold">{durLong}</span>
          </div>
        )}
        {a.notes && <div className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{a.notes}</div>}
      </div>
    </div>
  )
}

function StatusNode({ s }: { s: StatusLike }) {
  return (
    <div className="flex items-start gap-3 w-full">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-purple-200 bg-purple-50 text-purple-600">
        <Layers className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-slate-900">Status</span>
          {s.old_status && (
            <span className="text-xs text-slate-500 tabular-nums">{LEAD_STATUS_LABELS[s.old_status as LeadStatus]}</span>
          )}
          {s.old_status && <span className="text-slate-300">→</span>}
          <LeadStatusBadge status={s.new_status} />
        </div>
        <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
          {s.user?.full_name ?? 'System'} · {formatDate(s.created_at)}
        </div>
      </div>
    </div>
  )
}

function CallbackNode({ c }: { c: CallbackLike }) {
  return (
    <div className="flex items-start gap-3 w-full">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-600">
        <CalendarDays className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-slate-900">Rückruf geplant</span>
          <CallbackStatusBadge status={c.status} />
        </div>
        <div className="mt-1 text-sm text-slate-600 tabular-nums">
          {formatDateShort(c.callback_at)} · {formatTime(c.callback_at)}
        </div>
        {c.notes && <div className="mt-1 text-xs text-slate-500">{c.notes}</div>}
        <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
          erstellt {formatDate(c.created_at)}
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   Lead-Pipeline (Vorschlag 3)
   ========================================================= */
const PIPELINE_STATUSES: LeadStatus[] = [
  'new',
  'assigned',
  'contacted',
  'callback',
  'offer',
  'closed',
]

const PIPELINE_END_STATUSES: LeadStatus[] = ['no_interest', 'wrong_data', 'canceled']

export function LeadPipeline({ status }: { status: LeadStatus }) {
  const isEnd = PIPELINE_END_STATUSES.includes(status)
  const currentIdx = PIPELINE_STATUSES.indexOf(status)

  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-1">
        {PIPELINE_STATUSES.map((s, i) => {
          const isActive = i === currentIdx
          const isPast = i < currentIdx
          const isNext = i === currentIdx + 1
          const step = i + 1
          return (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold transition-all border-2',
                    isPast &&
                      'bg-emerald-500 text-white border-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]',
                    isActive &&
                      'bg-slate-900 text-white border-slate-900 shadow-[0_0_0_4px_rgba(15,23,42,0.15)] pulse-ring',
                    !isPast && !isActive &&
                      'bg-white text-slate-400 border-slate-200',
                  )}
                >
                  {isPast ? <CheckCircle2 className="h-4 w-4" /> : step}
                </div>
                <div
                  className={cn(
                    'mt-1.5 text-[10px] font-medium uppercase tracking-wider text-center leading-tight max-w-[72px]',
                    isActive ? 'text-slate-900' : isPast ? 'text-emerald-700' : 'text-slate-400',
                  )}
                >
                  {LEAD_STATUS_LABELS[s]}
                </div>
              </div>
              {i < PIPELINE_STATUSES.length - 1 && (
                <div className="h-0.5 w-full mx-1 mb-5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-500',
                      isPast || (isActive && i === currentIdx - 1)
                        ? 'bg-emerald-500 w-full'
                        : isNext
                        ? 'bg-emerald-200 w-1/3'
                        : 'w-0',
                    )}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {isEnd && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-600">
            {status === 'no_interest' ? <ThumbsDown className="h-3 w-3" /> : status === 'canceled' ? <X className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          </span>
          <LeadStatusBadge status={status} />
          <span className="text-slate-500">Lead wurde beendet / aussortiert</span>
        </div>
      )}
    </div>
  )
}

/* =========================================================
   LeadScorecard - erweiterte Summary Bar (Vorschlag 6)
   ========================================================= */

export function LeadScorecard({
  lastContactAt,
  attemptsCount,
  openCallbacksCount,
  leadAge,
  leadAgeClass,
  openCallbackOverdue,
  nextCallbackAt,
  totalTalkTimeSeconds,
}: {
  lastContactAt: string | null
  attemptsCount: number
  openCallbacksCount: number
  leadAge: number | null
  leadAgeClass: string
  openCallbackOverdue: boolean
  nextCallbackAt: string | null
  totalTalkTimeSeconds: number | null
}) {
  const lastDays = lastContactAt ? formatDaysSince(lastContactAt) : null
  const lastText = lastDays === null ? '—' : lastDays === 0 ? 'Heute' : `vor ${lastDays} T.`
  const ageText = leadAge === null ? '—' : leadAge === 0 ? 'Heute' : `${leadAge} T.`
  const talkShort = formatCallDuration(totalTalkTimeSeconds)
  const talkLong = formatCallDurationLong(totalTalkTimeSeconds)

  // Fortschrittsbalken: "Bearbeitungsfortschritt" (0-100%)
  // Heuristik: Anzahl Versuche / offene Rückrufe / Alter
  const activityScore = Math.min(
    100,
    Math.round(
      (attemptsCount > 0 ? Math.min(attemptsCount, 5) * 12 : 0) +
      (openCallbacksCount > 0 ? 25 : 0) +
      (lastDays !== null ? Math.max(0, 40 - lastDays * 4) : 0),
    ),
  )

  const urgency = openCallbackOverdue
    ? 'critical'
    : openCallbacksCount > 0
    ? 'action'
    : leadAge !== null && leadAge > 10
    ? 'warn'
    : lastDays !== null && lastDays > 7
    ? 'warn'
    : 'ok'

  const urgencyTone = {
    critical: 'border-red-300 bg-red-50/60 ring-red-200',
    action: 'border-amber-300 bg-amber-50/60 ring-amber-200',
    warn: 'border-amber-200 bg-amber-50/30',
    ok: 'border-emerald-200 bg-emerald-50/30',
  }[urgency]

  const items = [
    {
      label: 'Nächster Schritt',
      value:
        openCallbacksCount > 0
          ? nextCallbackAt
            ? `${formatDateShort(nextCallbackAt)} ${formatTime(nextCallbackAt)}`
            : `${openCallbacksCount} Rückruf${openCallbacksCount === 1 ? '' : 'e'}`
          : attemptsCount === 0
          ? 'Erstkontakt aufnehmen'
          : lastDays !== null && lastDays > 5
          ? 'Wiedervorlage'
          : 'Bearbeitung fortsetzen',
      hint:
        openCallbackOverdue
          ? 'Überfällig – Priorität hoch'
          : openCallbacksCount > 0
          ? `${openCallbacksCount} offen${nextCallbackAt ? ' · nächster:' + ' ' + formatDateShort(nextCallbackAt) : ''}`
          : attemptsCount > 0
          ? `Bisher ${attemptsCount} Versuch${attemptsCount === 1 ? '' : 'e'}`
          : 'Lead noch nicht kontaktiert',
      color:
        urgency === 'critical'
          ? 'text-red-600'
          : urgency === 'action'
          ? 'text-amber-700'
          : urgency === 'warn'
          ? 'text-amber-600'
          : 'text-emerald-700',
      icon:
        urgency === 'critical' ? (
          <AlertTriangle className="h-3.5 w-3.5" />
        ) : openCallbacksCount > 0 ? (
          <CalendarDays className="h-3.5 w-3.5" />
        ) : (
          <ZapIconInline className="h-3.5 w-3.5" />
        ),
      highlight: true,
    },
    {
      label: 'Letzter Kontakt',
      value: lastText,
      hint: attemptsCount > 0 ? `${attemptsCount} Versuch${attemptsCount === 1 ? '' : 'e'}` : 'Noch kein Kontakt',
      color: lastDays === null ? '' : lastDays <= 3 ? 'text-emerald-600' : lastDays <= 7 ? 'text-amber-600' : 'text-red-600',
      icon: <Clock className="h-3.5 w-3.5" />,
      progress: attemptsCount > 0 ? Math.min(100, attemptsCount * 25) : 0,
      progressColor:
        lastDays === null
          ? 'bg-slate-200'
          : lastDays <= 3
          ? 'bg-emerald-500'
          : lastDays <= 7
          ? 'bg-amber-500'
          : 'bg-red-500',
    },
    {
      label: 'Offene Rückrufe',
      value: String(openCallbacksCount),
      hint: openCallbacksCount > 0 ? `${openCallbacksCount} geplant` : 'Keine geplant',
      color: openCallbacksCount > 0 ? 'text-amber-600' : '',
      icon: <CalendarDays className="h-3.5 w-3.5" />,
      progress: Math.min(100, openCallbacksCount * 33),
      progressColor: openCallbacksCount > 0 ? 'bg-amber-500' : 'bg-slate-200',
    },
    {
      label: 'Lead-Alter',
      value: ageText,
      hint: 'seit Erstellung',
      color: leadAgeClass,
      icon: <History className="h-3.5 w-3.5" />,
      progress: leadAge !== null ? Math.min(100, leadAge * 6) : 0,
      progressColor:
        leadAge !== null
          ? leadAge <= 3
            ? 'bg-emerald-500'
            : leadAge <= 10
            ? 'bg-amber-500'
            : 'bg-red-500'
          : 'bg-slate-200',
    },
    {
      label: '∑ Gesprächszeit',
      value: talkShort ?? '00:00',
      hint: talkLong ? talkLong : 'Noch keine Gespräche dokumentiert',
      color: talkShort ? 'text-emerald-700' : '',
      icon: <Clock className="h-3.5 w-3.5" />,
      progress: Math.min(100, (totalTalkTimeSeconds ?? 0) / 18),
      progressColor: talkShort ? 'bg-emerald-500' : 'bg-slate-200',
    },
  ]

  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 rounded-2xl border bg-white p-3 shadow-sm sm:gap-3 sm:p-4 mt-2 w-full animate-in fade-in slide-in-from-top-2 ring-1 ring-transparent transition-all duration-300',
        urgencyTone,
        openCallbackOverdue && 'urgent-pulse',
      )}
    >
      {/* Aktivitäts-Score (ganz oben, volle Breite) */}
      <div className="col-span-1 sm:col-span-2 lg:col-span-5 flex items-center gap-2 -mb-1">
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          Aktivitäts-Score
        </div>
        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700"
            style={{ width: `${activityScore}%` }}
          />
        </div>
        <div className="text-[10px] font-semibold tabular-nums text-slate-600 min-w-[28px] text-right">
          {activityScore}/100
        </div>
      </div>

      {items.map((it, i) => (
        <div
          key={i}
          className={cn(
            'flex flex-col rounded-xl border bg-white p-2.5 sm:p-3 relative overflow-hidden',
            it.highlight
              ? 'border-slate-200 shadow-sm sm:col-span-1'
              : 'border-slate-100',
          )}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
            {it.icon}
            <span>{it.label}</span>
          </div>
          <div className={cn('mt-1 text-lg font-semibold tabular-nums leading-tight truncate', it.color)}>
            {it.value}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500 truncate">{it.hint}</div>
          {typeof it.progress === 'number' && (
            <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', it.progressColor ?? 'bg-slate-400')}
                style={{ width: `${it.progress}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ZapIconInline({ className }: { className?: string }) {
  // Inline SVG (Zap) als Component, damit es als Icon genutzt werden kann
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

/* =========================================================
   NextStepPanel - Sticky Panel für rechte Spalte (Vorschlag 4)
   ========================================================= */

export function NextStepPanel({
  openCallbacks,
  attemptsCount,
  lastContactAt,
  leadAge,
  status,
}: {
  openCallbacks: CallbackLike[]
  attemptsCount: number
  lastContactAt: string | null
  leadAge: number | null
  status: LeadStatus
}) {
  const nextCb = openCallbacks
    .filter((c) => c.status === 'offen')
    .sort((a, b) => new Date(a.callback_at).getTime() - new Date(b.callback_at).getTime())[0]

  const overdue = nextCb ? new Date(nextCb.callback_at).getTime() < Date.now() - 60_000 : false
  const lastDays = lastContactAt ? formatDaysSince(lastContactAt) : null

  type Task = {
    title: string
    sub?: string
    tone: 'critical' | 'action' | 'info' | 'ok'
    reason?: string
  }
  const tasks: Task[] = []
  if (nextCb) {
    tasks.push({
      title: overdue ? 'Rückruf überfällig' : 'Rückruf durchführen',
      sub: `${formatDateShort(nextCb.callback_at)} · ${formatTime(nextCb.callback_at)}${nextCb.notes ? ' — ' + nextCb.notes : ''}`,
      tone: overdue ? 'critical' : 'action',
      reason: overdue
        ? 'Geplanter Rückruf liegt in der Vergangenheit → höchste Priorität'
        : 'Rückruf ist der nächste dokumentierte Termin in der Historie',
    })
  } else if (attemptsCount === 0) {
    tasks.push({
      title: 'Erstkontakt aufnehmen',
      sub: 'Noch kein Kontaktversuch dokumentiert',
      tone: 'action',
      reason: 'Lead ist noch unberührt; Quote sinkt mit jedem unberührten Tag um ~10%',
    })
  } else if (lastDays !== null && lastDays > 7) {
    tasks.push({
      title: 'Wiedervorlage einplanen',
      sub: `Letzter Kontakt vor ${lastDays} Tagen`,
      tone: 'action',
      reason: `Nach ${lastDays} Tagen ohne Kontakt sinkt die Abschlusswahrscheinlichkeit deutlich`,
    })
  } else {
    tasks.push({
      title: 'Aktuell kein dringender Schritt',
      sub: 'Bearbeitung nach Bedarf fortsetzen',
      tone: 'ok',
      reason: 'Alle offenen Aufgaben sind erledigt oder liegen außerhalb der Frist',
    })
  }
  if (status === 'new')
    tasks.push({
      title: 'Status auf Zugewiesen setzen',
      sub: 'Lead offiziell in Bearbeitung nehmen',
      tone: 'info',
      reason: 'Status wird für die korrekte Berechnung des Pipelines-Fortschritts benötigt',
    })
  if (status === 'contacted' && !nextCb)
    tasks.push({
      title: 'Rückruf oder nächsten Schritt planen',
      tone: 'info',
      reason: 'Ohne festen nächsten Termin droht der Lead in der Warteschleife zu verschwinden',
    })
  if (leadAge !== null && leadAge > 14 && status !== 'closed' && status !== 'canceled' && status !== 'no_interest') {
    tasks.push({
      title: 'Finalen Abschluss prüfen',
      sub: `Lead-Alter: ${leadAge} Tage`,
      tone: 'info',
      reason: 'Leads älter als 14 Tage haben eine deutlich reduzierte Conversion-Chance',
    })
  }

  const toneClasses = {
    critical: 'border-red-200 bg-red-50 text-red-700',
    action: 'border-amber-200 bg-amber-50 text-amber-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }
  const toneDot = {
    critical: 'bg-red-500',
    action: 'bg-amber-500',
    info: 'bg-blue-500',
    ok: 'bg-emerald-500',
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-2">
      <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ZapIconInline className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Nächster Schritt</h3>
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600">
            <Sparkles className="h-2.5 w-2.5" />
            KI-Vorschlag
          </span>
        </div>
        {overdue && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 pulse-dot">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 pulse-ring-inline" />
            Dringend
          </span>
        )}
      </div>
      <div className="p-3 space-y-2">
        {tasks.slice(0, 3).map((t, i) => (
          <div
            key={i}
            className={cn(
              'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 group transition-colors',
              toneClasses[t.tone],
              overdue && t.tone === 'critical' && 'urgent-pulse',
            )}
          >
            <span className={cn('mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full', toneDot[t.tone])} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold leading-tight">{t.title}</div>
              {t.sub && <div className="mt-0.5 text-[11px] opacity-90 leading-tight truncate">{t.sub}</div>}
              {t.reason && (
                <div className="mt-1 text-[10px] opacity-0 group-hover:opacity-80 leading-tight transition-opacity flex items-start gap-1">
                  <Sparkles className="h-2.5 w-2.5 shrink-0 mt-0.5" />
                  <span className="italic">{t.reason}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* =========================================================
   MiniTimelineSidebar - kompakte Historie für rechte Spalte (Vorschlag 4)
   ========================================================= */

export function MiniTimelineSidebar({
  attempts,
  statusChanges,
  callbacks,
  defaultLimit = 3,
}: {
  attempts: AttemptLike[]
  statusChanges: StatusLike[]
  callbacks: CallbackLike[]
  defaultLimit?: number
}) {
  const [expanded, setExpanded] = useState(false)

  const all = useMemo(() => {
    type E = { at: string; kind: 'attempt' | 'status' | 'callback'; data: any }
    const l: E[] = []
    for (const a of attempts) l.push({ at: a.attempt_date, kind: 'attempt', data: a })
    for (const s of statusChanges) l.push({ at: s.created_at, kind: 'status', data: s })
    for (const c of callbacks) l.push({ at: c.callback_at, kind: 'callback', data: c })
    l.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    return l
  }, [attempts, statusChanges, callbacks])

  const limit = expanded ? all.length : Math.min(defaultLimit, all.length)
  const shown = all.slice(0, limit)

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Letzte Aktivitäten</h3>
          <span className="text-[10px] font-medium text-slate-400 tabular-nums">({all.length})</span>
        </div>
      </div>
      <div className="p-3 space-y-2">
        {shown.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-4 rounded-lg border border-dashed border-slate-200 bg-slate-50">
            Noch keine Aktivitäten
          </div>
        ) : (
          shown.map((e, i) => {
            const attemptDur = e.kind === 'attempt' ? formatCallDuration(e.data.call_duration_seconds) : null
            return (
              <div
                key={i}
                className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-2"
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px]',
                    e.kind === 'attempt'
                      ? attemptDur
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-blue-200 bg-blue-50 text-blue-600'
                      : e.kind === 'status'
                        ? 'border-purple-200 bg-purple-50 text-purple-600'
                        : 'border-amber-200 bg-amber-50 text-amber-600',
                  )}
                >
                  {e.kind === 'attempt' && <Phone className="h-3 w-3" />}
                  {e.kind === 'status' && <Layers className="h-3 w-3" />}
                  {e.kind === 'callback' && <CalendarDays className="h-3 w-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="text-[11px] font-medium text-slate-800 truncate leading-tight">
                      {e.kind === 'attempt' && 'Kontaktversuch · ' + (CONTACT_RESULT_LABELS[e.data.result as keyof typeof CONTACT_RESULT_LABELS] ?? e.data.result)}
                      {e.kind === 'status' &&
                        'Status: ' +
                          (e.data.old_status ? LEAD_STATUS_LABELS[e.data.old_status as LeadStatus] + ' → ' : '') +
                          LEAD_STATUS_LABELS[e.data.new_status as LeadStatus]}
                      {e.kind === 'callback' &&
                        'Rückruf ' +
                          (e.data.status === 'offen'
                            ? 'geplant'
                            : e.data.status === 'erledigt'
                            ? 'erledigt'
                            : 'storniert')}
                    </div>
                    {attemptDur && (
                      <span className="inline-flex items-center rounded bg-emerald-50 border border-emerald-200 px-1 py-0.5 text-[9px] font-semibold text-emerald-700 tabular-nums">
                        ⏱ {attemptDur}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 tabular-nums leading-tight mt-0.5">
                    {formatDateShort(e.at)} · {formatTime(e.at)}
                  </div>
                </div>
              </div>
            )
          })
        )}
        {all.length > defaultLimit && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Weniger anzeigen
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                {all.length - defaultLimit} weitere anzeigen
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

/* =========================================================
   CompactTagsSidebar - kompakte Tag-Chips für Sidebar (Vorschlag 4 + 7)
   ========================================================= */

export function CompactTagsSidebar({
  leadId,
  tags,
}: {
  leadId: string
  tags: TagLike[]
}) {
  const [expanded, setExpanded] = useState(false)
  const tagColor = (c: string | null) => {
    if (c && /^#?[0-9a-f]{6}$/i.test(c)) {
      const hex = c.startsWith('#') ? c : `#${c}`
      return { backgroundColor: `${hex}20`, color: hex, borderColor: `${hex}40` } as any
    }
    return undefined
  }

  const firstTags = expanded ? tags : tags.slice(0, 6)
  const hasMore = tags.length > 6

  if (tags.length === 0) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
        <TagIcon className="h-3.5 w-3.5 text-slate-500" />
        <h3 className="text-xs font-semibold text-slate-800 tracking-tight">Schlagworte</h3>
        <span className="text-[10px] font-medium text-slate-400 tabular-nums ml-auto">({tags.length})</span>
      </div>
      <div className="px-3 py-2.5 flex flex-wrap gap-1.5">
        {firstTags.map((t) => (
          <span
            key={t.id}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
              tagColor(t.color) ? '' : 'bg-slate-100 text-slate-700 border-slate-200',
            )}
            style={tagColor(t.color)}
          >
            {t.name}
          </span>
        ))}
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex h-5 items-center justify-center rounded-full border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
          >
            {expanded ? 'weniger' : `+${tags.length - 6}`}
          </button>
        )}
      </div>
    </div>
  )
}

/* =========================================================
   CompactTagsInline (für Übersichts-Tab)
   ========================================================= */

export function CompactTagsInline({ tags }: { tags: { id: string; name: string; color: string | null }[] }) {
  function tagColor(c: string | null): React.CSSProperties | undefined {
    if (c && /^#?[0-9a-f]{6}$/i.test(c)) {
      const hex = c.startsWith('#') ? c : `#${c}`
      return { backgroundColor: `${hex}20`, color: hex, borderColor: `${hex}40` }
    }
    return undefined
  }
  return (
    <>
      {tags.map((t) => (
        <span
          key={t.id}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
            tagColor(t.color) ? '' : 'bg-slate-100 text-slate-700 border-slate-200',
          )}
          style={tagColor(t.color)}
        >
          <TagIcon className="h-2.5 w-2.5" />
          {t.name}
        </span>
      ))}
    </>
  )
}

/* =========================================================
   CompactStatusHistory (Vorschlag 7) - nur 2 default sichtbar
   ========================================================= */

export function CompactStatusHistory({
  history,
  defaultLimit = 2,
}: {
  history: { id: string; created_at: string; old_status?: string; new_status: string; user?: any }[]
  defaultLimit?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const sorted = [...history].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const limit = expanded ? sorted.length : Math.min(defaultLimit, sorted.length)
  const shown = sorted.slice(0, limit)
  const hasMore = sorted.length > defaultLimit

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
        <Layers className="h-3.5 w-3.5 text-slate-500" />
        <h3 className="text-xs font-semibold text-slate-800 tracking-tight">Status-Verlauf</h3>
        <span className="text-[10px] font-medium text-slate-400 tabular-nums ml-auto">({sorted.length})</span>
      </div>
      <div className="p-3 space-y-1.5">
        {shown.map((h: any) => (
          <div
            key={h.id}
            className="flex items-start justify-between gap-2.5 rounded-lg border border-slate-100 bg-slate-50/40 px-2.5 py-2"
          >
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-purple-200 bg-purple-50 text-purple-600">
                <Layers className="h-2.5 w-2.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs flex-wrap">
                  {h.old_status && (
                    <>
                      <span className="text-[10px] text-slate-500 tabular-nums">
                        {LEAD_STATUS_LABELS[h.old_status as LeadStatus]}
                      </span>
                      <span className="text-slate-300 text-[10px]">→</span>
                    </>
                  )}
                  <LeadStatusBadge status={h.new_status} />
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500 tabular-nums truncate">
                  {h.user?.full_name ?? 'System'} · {formatDateShort(h.created_at)}
                </div>
              </div>
            </div>
          </div>
        ))}
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-2.5 w-2.5" />
                Weniger
              </>
            ) : (
              <>
                <ChevronDown className="h-2.5 w-2.5" />
                {sorted.length - defaultLimit} weitere
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

/* =========================================================
   SecondaryInfoCard (Kontakt-Sekundärinfo - als Client für konsistente API)
   ========================================================= */

export function SecondaryInfoCard({ lead, campaign }: { lead: any; campaign: any }) {
  const hasSecondary = Boolean(
    lead.street || lead.zip || lead.city || lead.source || campaign || lead.product ||
    lead.power_consumption || lead.gas_consumption,
  )
  if (!hasSecondary) return null

  return (
    <details className="group rounded-xl border border-slate-200 bg-white open:bg-slate-50/30 transition-colors">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 select-none">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <MapPin className="h-3 w-3" /> Weitere Informationen (Adresse, Produkt, Quelle)
        </h3>
        <div className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 group-open:rotate-180 transition-transform">
          <ChevronDown className="h-3.5 w-3.5" />
        </div>
      </summary>
      <div className="px-3.5 pb-3.5 pt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 animate-in fade-in slide-in-from-top-1">
        {(lead.street || lead.zip || lead.city) && (
          <div className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
            <MapPin className="mt-0.5 shrink-0 h-3.5 w-3.5 text-slate-400" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Adresse</div>
              <div className="mt-0.5 text-sm text-slate-800 leading-snug">
                <div>{lead.street ?? '—'}</div>
                <div className="text-xs text-slate-500 tabular-nums">
                  {[lead.zip, lead.city].filter(Boolean).join(' ') || '—'}
                </div>
              </div>
              {(lead.street || lead.zip || lead.city) ? (
                <div className="mt-1">
                  <CopyButton
                    text={`${lead.street ?? ''}, ${[lead.zip, lead.city].filter(Boolean).join(' ')}`.trim()}
                    size="sm"
                    ariaLabel="Adresse kopieren"
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
        <div className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
          <UserCircle className="mt-0.5 shrink-0 h-3.5 w-3.5 text-slate-400" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Quelle / Kampagne</div>
            <div className="mt-0.5 text-sm text-slate-800 leading-snug">
              <div className="font-medium">{SOURCE_LABELS[lead.source as keyof typeof SOURCE_LABELS] ?? lead.source}</div>
              <div className="text-xs text-slate-500">{campaign?.name ?? 'Keine Kampagne'}</div>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 sm:col-span-2">
          <ZapInline className="mt-0.5 shrink-0 h-3.5 w-3.5 text-slate-400" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Produkt & Verbrauch</div>
            <div className="mt-0.5 text-sm text-slate-800 leading-snug">
              <div className="font-medium">{PRODUCT_LABELS[lead.product as keyof typeof PRODUCT_LABELS]}</div>
              <div className="text-xs text-slate-500 tabular-nums">
                {lead.power_consumption ? `Strom: ${lead.power_consumption.toLocaleString('de-DE')} kWh` : ''}
                {lead.power_consumption && lead.gas_consumption ? ' · ' : ''}
                {lead.gas_consumption ? `Gas: ${lead.gas_consumption.toLocaleString('de-DE')} kWh` : ''}
                {!lead.power_consumption && !lead.gas_consumption ? 'Keine Verbrauchswerte' : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    </details>
  )
}

function ZapInline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

/* Fallback: avoid bundler warning about unused require() usage */
if (typeof window === 'undefined') {
  void null
}
