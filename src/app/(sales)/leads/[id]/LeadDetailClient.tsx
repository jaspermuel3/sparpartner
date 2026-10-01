'use client'

import { useMemo, useState } from 'react'
import { useFormState } from 'react-dom'
import Link from 'next/link'
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
  Sparkles,
  Calendar,
} from 'lucide-react'
import {
  assignTagToLeadAction,
  removeTagFromLeadAction,
  createTagAction,
  addLeadDocumentAction,
  deleteLeadDocumentAction,
  updateLeadStatusAction,
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
import {
  LEAD_STATUS_LABELS,
  CONTACT_RESULT_LABELS,
  formatDate,
  formatDateShort,
  formatTime,
  formatBytes,
  phoneHref,
  formatDaysSince,
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
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white/70 p-3 backdrop-blur shadow-sm sm:grid-cols-4 sm:gap-3 sm:p-4 mt-2 max-w-3xl">
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
   #44 - Sticky Action Bar
   ========================================================= */

export function LeadActionBar({
  leadId,
  phone,
  email,
}: {
  leadId: string
  phone: string | null
  email: string | null
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 backdrop-blur-lg shadow-[0_-8px_30px_rgba(15,23,42,0.08)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden text-xs font-medium uppercase tracking-wider text-slate-400 sm:inline">
            Schnellaktionen
          </span>
        </div>
        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2 flex-wrap">
          {phone ? (
            <a
              href={phoneHref(phone)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 sm:px-3 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Anrufen</span>
            </a>
          ) : null}
          {email ? (
            <a
              href={`mailto:${email}`}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 sm:px-3 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">E-Mail</span>
            </a>
          ) : null}
          {phone ? (
            <CopyButton text={phone} ariaLabel="Telefon kopieren" size="sm" className="h-10">
              <Phone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1">Nr. kopieren</span>
            </CopyButton>
          ) : null}
          <QuickStatusSelect leadId={leadId} />
          <Link
            href={`/my-leads`}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <span className="hidden sm:inline">Leads-Liste</span>
            <span className="sm:hidden">Alle</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
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
              Demo: Speichert nur Metadaten in der DB (Storage-Integration nach Migration)
            </div>
          </div>
        </Label>
        <input
          id={`doc-upload-${leadId}`}
          name="file"
          type="file"
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
        <SubmitButton size="sm" className="h-9 px-4 text-xs" disabled={!fileName}>
          <FileText className="h-3.5 w-3.5" />
          Hinzufügen
        </SubmitButton>
      </div>
    </form>
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
  return (
    <div className="flex items-start gap-3 w-full">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600">
        <Phone className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-slate-900">Kontaktversuch</span>
          <ContactResultPill result={a.result} />
        </div>
        {a.notes && <div className="mt-1 text-sm text-slate-600">{a.notes}</div>}
        <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">{formatDate(a.attempt_date)}</div>
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

/* Fallback: avoid bundler warning about unused require() usage */
if (typeof window === 'undefined') {
  void null
}
