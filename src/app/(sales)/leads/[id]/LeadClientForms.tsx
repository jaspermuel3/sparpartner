'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormState } from 'react-dom'
import {
  updateLeadStatusAction,
  updateLeadNotesAction,
  addContactAttemptAction,
  createCallbackAction,
  updateCallbackStatusAction,
} from '@/app/actions'
import { SubmitButton, useActionFeedback, type ActionResult, showSaveIndicator } from '@/components/ui-custom/FormHelpers'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Pencil,
  Save,
  Plus,
  Check,
  Phone,
  CalendarDays,
  Clock,
  Layers,
  AlertCircle,
  FileWarning,
  RotateCcw,
} from 'lucide-react'
import {
  LEAD_STATUS_LABELS,
  CONTACT_RESULT_LABELS,
} from '@/lib/constants'
import type { LeadStatus, ContactResult } from '@/types'
import { cn } from '@/lib/utils'

const NOTES_DRAFT_KEY = (id: string) => `crm:leads:${id}:notes-draft:v1`

/* ---------- Status (Kompakt) ---------- */
export function StatusFormCard({
  initialStatus,
  leadId,
}: {
  initialStatus: LeadStatus
  leadId: string
}) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await updateLeadStatusAction(fd)) as any,
    null,
  )
  useActionFeedback(state, { saveLabel: 'Status aktualisiert' })
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
  const [selected, setSelected] = useState<string>(initialStatus)
  useEffect(() => setSelected(initialStatus), [initialStatus])
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Layers className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800 tracking-tight leading-tight">Status ändern</div>
          <div className="text-[11px] text-slate-500 leading-tight">Aktualisiere den Bearbeitungsstand</div>
        </div>
      </div>
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="leadId" value={leadId} />
        <div className="space-y-1">
          <Label htmlFor={`status-${leadId}`} className="text-[11px] uppercase tracking-widest text-slate-400 font-medium">
            Neuer Status
          </Label>
          <Select name="status" value={selected} onValueChange={setSelected}>
            <SelectTrigger id={`status-${leadId}`} className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s} value={s} className="text-sm">
                  {LEAD_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {state?.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 fade-slide-up">
            {state.error}
          </div>
        )}
        <SubmitButton variant="default" size="sm" className="w-full h-9 text-xs">
          <Save className="h-3.5 w-3.5" />
          Status speichern
        </SubmitButton>
      </form>
    </div>
  )
}

/* ---------- Notizen (Kompakt) ---------- */
export function NotesFormCard({
  initialNotes,
  leadId,
}: {
  initialNotes: string
  leadId: string
}) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await updateLeadNotesAction(fd)) as any,
    null,
  )
  useActionFeedback(state, { saveLabel: 'Notizen gespeichert' })

  const [notes, setNotes] = useState(initialNotes)
  const [draftMode, setDraftMode] = useState<'none' | 'has-draft' | 'mismatch'>('none')
  const [, setSavedKey] = useState(0)
  const lastSaved = useRef(initialNotes)

  useEffect(() => {
    setNotes(initialNotes)
    lastSaved.current = initialNotes
  }, [initialNotes, leadId])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTES_DRAFT_KEY(leadId))
      if (raw && raw.trim() && raw.trim() !== initialNotes.trim()) {
        setNotes(raw)
        setDraftMode('has-draft')
      } else {
        setDraftMode('none')
      }
    } catch {
      setDraftMode('none')
    }
  }, [leadId, initialNotes])

  useEffect(() => {
    try {
      if (notes === initialNotes || !notes.trim()) {
        localStorage.removeItem(NOTES_DRAFT_KEY(leadId))
        if (notes === lastSaved.current) setDraftMode('none')
        else if (notes.trim()) setDraftMode('mismatch')
      } else {
        localStorage.setItem(NOTES_DRAFT_KEY(leadId), notes)
        if (notes !== lastSaved.current) setDraftMode('mismatch')
      }
    } catch {}
  }, [notes, leadId, initialNotes])

  function resetToSaved() {
    setNotes(initialNotes)
    try {
      localStorage.removeItem(NOTES_DRAFT_KEY(leadId))
    } catch {}
    setDraftMode('none')
  }

  function resetToDraft() {
    try {
      const raw = localStorage.getItem(NOTES_DRAFT_KEY(leadId))
      if (raw) {
        setNotes(raw)
        setDraftMode('mismatch')
      }
    } catch {}
  }

  const validState = notes.trim().length > 10 ? 'valid' : 'idle'

  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Pencil className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-1.5">
            <div className="text-sm font-semibold text-slate-800 tracking-tight leading-tight">Notizen</div>
            {draftMode !== 'none' ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 fade-slide-up">
                {draftMode === 'has-draft' ? (
                  <>
                    <FileWarning className="h-2.5 w-2.5" />
                    Entwurf
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-2.5 w-2.5" />
                    Ungespeichert
                  </>
                )}
              </span>
            ) : null}
          </div>
          <div className="text-[11px] text-slate-500 leading-tight">Interne Hinweise & Gesprächsnotizen</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {draftMode === 'has-draft' ? (
            <button
              type="button"
              onClick={resetToSaved}
              title="Gespeicherten Stand laden"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-3 w-3" />
              Laden
            </button>
          ) : draftMode === 'mismatch' ? (
            <button
              type="button"
              onClick={resetToDraft}
              title="Entwurf laden"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 text-[10px] font-medium text-amber-700 hover:bg-amber-100"
            >
              <FileWarning className="h-3 w-3" />
              Entwurf
            </button>
          ) : null}
        </div>
      </div>
      <form
        action={(fd) => {
          const val = String(fd.get('notes') ?? '')
          lastSaved.current = val
          try {
            localStorage.removeItem(NOTES_DRAFT_KEY(leadId))
          } catch {}
          setSavedKey((k) => k + 1)
          setDraftMode('none')
          showSaveIndicator('Notizen werden gespeichert…')
          formAction(fd)
        }}
        className="space-y-2"
      >
        <input type="hidden" name="leadId" value={leadId} />
        <Textarea
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Gesprächsnotizen, Besonderheiten, Konditionen…"
          rows={5}
          className={cn(
            'resize-none text-sm transition-all duration-150 leading-relaxed',
            validState === 'valid' && draftMode === 'mismatch' && 'field-valid',
            state?.error && 'field-invalid',
          )}
        />
        <div className="flex items-center justify-between text-[10px] text-slate-500 tabular-nums">
          <span>{notes.trim().length} Zeichen</span>
          <span>
            {draftMode === 'none' ? (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <Check className="h-2.5 w-2.5" />
                Gespeichert
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <FileWarning className="h-2.5 w-2.5" />
                Lokal vorgehalten
              </span>
            )}
          </span>
        </div>
        {state?.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 fade-slide-up">
            {state.error}
          </div>
        )}
        <SubmitButton variant="outline" size="sm" className="w-full h-9 text-xs">
          <Save className="h-3.5 w-3.5" />
          Notizen speichern
        </SubmitButton>
      </form>
    </div>
  )
}

/* ---------- Kontaktversuch (Kompakt) ---------- */
export function ContactAttemptForm({ leadId }: { leadId: string }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await addContactAttemptAction(fd)) as any,
    null,
  )
  useActionFeedback(state, { saveLabel: 'Kontaktversuch gespeichert' })
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const results = Object.keys(CONTACT_RESULT_LABELS) as ContactResult[]

  const [dateVal, setDateVal] = useState(today)
  const [timeVal, setTimeVal] = useState(hhmm)
  const [resultVal, setResultVal] = useState<ContactResult>('keine_antwort')
  const [noteVal, setNoteVal] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!dateVal) e.date = 'Datum erforderlich'
    if (!timeVal) e.time = 'Uhrzeit erforderlich'
    if (noteVal.length > 2000) e.notes = 'Max. 2000 Zeichen'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
          <Phone className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800 tracking-tight leading-tight">Neuer Kontaktversuch</div>
          <div className="text-[11px] text-slate-500 leading-tight">Dokumentiere das Gesprächsergebnis</div>
        </div>
      </div>
      <form
        action={(fd) => {
          if (!validate()) return
          formAction(fd)
        }}
        className="space-y-2"
      >
        <input type="hidden" name="leadId" value={leadId} />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor={`ca-date-${leadId}`} className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
              Datum
            </Label>
            <Input
              id={`ca-date-${leadId}`}
              type="date"
              name="date"
              value={dateVal}
              onChange={(e) => {
                setDateVal(e.target.value)
                setErrors((p) => ({ ...p, date: '' }))
              }}
              className={cn('h-9 text-xs', errors.date && 'field-invalid', !errors.date && dateVal && 'field-valid')}
            />
            {errors.date && <div className="text-[9px] text-red-600 leading-tight">{errors.date}</div>}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`ca-time-${leadId}`} className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
              Uhrzeit
            </Label>
            <Input
              id={`ca-time-${leadId}`}
              type="time"
              name="time"
              value={timeVal}
              onChange={(e) => {
                setTimeVal(e.target.value)
                setErrors((p) => ({ ...p, time: '' }))
              }}
              className={cn('h-9 text-xs', errors.time && 'field-invalid', !errors.time && timeVal && 'field-valid')}
            />
            {errors.time && <div className="text-[9px] text-red-600 leading-tight">{errors.time}</div>}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`ca-result-${leadId}`} className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
            Ergebnis
          </Label>
          <Select name="result" value={resultVal} onValueChange={(v) => setResultVal(v as any)}>
            <SelectTrigger id={`ca-result-${leadId}`} className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {results.map((r) => (
                <SelectItem key={r} value={r} className="text-sm">
                  {CONTACT_RESULT_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`ca-notes-${leadId}`} className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
            Notiz (optional)
          </Label>
          <Textarea
            id={`ca-notes-${leadId}`}
            name="notes"
            rows={2}
            value={noteVal}
            onChange={(e) => {
              setNoteVal(e.target.value)
              if (e.target.value.length > 2000) setErrors((p) => ({ ...p, notes: 'Max. 2000 Zeichen' }))
              else setErrors((p) => ({ ...p, notes: '' }))
            }}
            placeholder="Gesprächsinhalt, Konditionen, Bedenken…"
            className={cn('resize-none text-xs leading-relaxed', errors.notes && 'field-invalid')}
          />
          <div className="flex items-center justify-between text-[9px] text-slate-500 tabular-nums">
            <span>{errors.notes ?? ''}</span>
            <span className={cn(noteVal.length > 1800 && 'text-amber-600', noteVal.length > 2000 && 'text-red-600')}>
              {noteVal.length}/2000
            </span>
          </div>
        </div>
        {state?.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 fade-slide-up">
            {state.error}
          </div>
        )}
        <SubmitButton variant="default" size="sm" className="w-full h-9 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Kontaktversuch speichern
        </SubmitButton>
      </form>
    </div>
  )
}

/* ---------- Rückruf (Kompakt) ---------- */
export function CallbackForm({ leadId }: { leadId: string }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await createCallbackAction(fd)) as any,
    null,
  )
  useActionFeedback(state, { saveLabel: 'Rückruf geplant' })
  const tmrw = new Date()
  tmrw.setDate(tmrw.getDate() + 1)
  const today = tmrw.toISOString().slice(0, 10)

  const [dateVal, setDateVal] = useState(today)
  const [timeVal, setTimeVal] = useState('10:00')
  const [noteVal, setNoteVal] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!dateVal) e.date = 'Datum erforderlich'
    if (!timeVal) e.time = 'Uhrzeit erforderlich'
    if (noteVal.length > 500) e.notes = 'Max. 500 Zeichen'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
          <CalendarDays className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800 tracking-tight leading-tight">Rückruf planen</div>
          <div className="text-[11px] text-slate-500 leading-tight">Zeitpunkt für nächsten Kontakt setzen</div>
        </div>
      </div>
      <form
        action={(fd) => {
          if (!validate()) return
          formAction(fd)
        }}
        className="space-y-2"
      >
        <input type="hidden" name="leadId" value={leadId} />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor={`cb-date-${leadId}`} className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
              Datum
            </Label>
            <Input
              id={`cb-date-${leadId}`}
              type="date"
              name="date"
              value={dateVal}
              onChange={(e) => {
                setDateVal(e.target.value)
                setErrors((p) => ({ ...p, date: '' }))
              }}
              className={cn('h-9 text-xs', errors.date && 'field-invalid', !errors.date && dateVal && 'field-valid')}
            />
            {errors.date && <div className="text-[9px] text-red-600 leading-tight">{errors.date}</div>}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`cb-time-${leadId}`} className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
              Uhrzeit
            </Label>
            <Input
              id={`cb-time-${leadId}`}
              type="time"
              name="time"
              value={timeVal}
              onChange={(e) => {
                setTimeVal(e.target.value)
                setErrors((p) => ({ ...p, time: '' }))
              }}
              className={cn('h-9 text-xs', errors.time && 'field-invalid', !errors.time && timeVal && 'field-valid')}
            />
            {errors.time && <div className="text-[9px] text-red-600 leading-tight">{errors.time}</div>}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`cb-notes-${leadId}`} className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
            Notiz (optional)
          </Label>
          <Textarea
            id={`cb-notes-${leadId}`}
            name="notes"
            rows={2}
            value={noteVal}
            onChange={(e) => {
              setNoteVal(e.target.value)
              if (e.target.value.length > 500) setErrors((p) => ({ ...p, notes: 'Max. 500 Zeichen' }))
              else setErrors((p) => ({ ...p, notes: '' }))
            }}
            placeholder="Thema, Erinnerung…"
            className={cn('resize-none text-xs leading-relaxed', errors.notes && 'field-invalid')}
          />
          <div className="flex items-center justify-between text-[9px] text-slate-500 tabular-nums">
            <span>{errors.notes ?? ''}</span>
            <span className={cn(noteVal.length > 400 && 'text-amber-600', noteVal.length > 500 && 'text-red-600')}>
              {noteVal.length}/500
            </span>
          </div>
        </div>
        {state?.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 fade-slide-up">
            {state.error}
          </div>
        )}
        <SubmitButton variant="default" size="sm" className="w-full h-9 text-xs">
          <CalendarDays className="h-3.5 w-3.5" />
          Rückruf speichern
        </SubmitButton>
      </form>
    </div>
  )
}

/* ---------- Rückruf Quick Actions ---------- */
export function CallbackQuickActions({
  callbackId,
  leadId,
  status,
}: {
  callbackId: string
  leadId: string
  status: string
}) {
  const [doneState, doneAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await updateCallbackStatusAction(fd)) as any,
    null,
  )
  useActionFeedback(doneState)

  const [cancelState, cancelAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await updateCallbackStatusAction(fd)) as any,
    null,
  )
  useActionFeedback(cancelState)

  return (
    <div className="flex flex-col items-end gap-1">
      {status === 'offen' && (
        <>
          <form action={doneAction} className="m-0">
            <input type="hidden" name="callbackId" value={callbackId} />
            <input type="hidden" name="leadId" value={leadId} />
            <input type="hidden" name="status" value="erledigt" />
            <SubmitButton
              variant="ghost"
              size="sm"
              className="h-6 px-2 py-0.5 text-[11px] rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shadow-none"
              pendingLabel="…"
            >
              <Check className="h-3 w-3" /> Erledigt
            </SubmitButton>
          </form>
          <form action={cancelAction} className="m-0">
            <input type="hidden" name="callbackId" value={callbackId} />
            <input type="hidden" name="leadId" value={leadId} />
            <input type="hidden" name="status" value="storniert" />
            <SubmitButton
              variant="ghost"
              size="sm"
              className="h-6 px-2 py-0.5 text-[11px] rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-none"
              pendingLabel="…"
            >
              Stornieren
            </SubmitButton>
          </form>
        </>
      )}
    </div>
  )
}

/* ---------- Timeline Icons (Kleinkram) ---------- */
export const Icons = { Layers, Phone, CalendarDays, Clock }
