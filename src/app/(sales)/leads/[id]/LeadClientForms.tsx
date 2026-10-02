'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormState } from 'react-dom'
import {
  updateLeadStatusAction,
  updateLeadNotesAction,
  addContactAttemptAction,
  createCallbackAction,
  updateCallbackStatusAction,
  sellerRequestCancellationAction,
} from '@/app/actions'
import { SubmitButton, useActionFeedback, type ActionResult, showSaveIndicator } from '@/components/ui-custom/FormHelpers'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
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
  Timer,
  TimerOff,
  Ban,
  ShieldCheck,
  XCircle,
  CheckCircle2,
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
  const [draftMode, setDraftMode] = useState<'none' | 'has-draft' | 'mismatch' | 'autosaving'>('none')
  const [, setSavedKey] = useState(0)
  const lastSaved = useRef(initialNotes)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => {
    if (notes === lastSaved.current) return
    if (!notes.trim() && !initialNotes.trim()) return

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      if (notes === lastSaved.current || !notes.trim()) return
      const fd = new FormData()
      fd.append('leadId', leadId)
      fd.append('notes', notes)
      setDraftMode('autosaving')
      showSaveIndicator('Wird automatisch gespeichert…')
      lastSaved.current = notes
      try {
        localStorage.removeItem(NOTES_DRAFT_KEY(leadId))
      } catch {}
      formAction(fd)
      setSavedKey((k) => k + 1)
      setTimeout(() => setDraftMode('none'), 1200)
    }, 1000)

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [notes, leadId, initialNotes, formAction])

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
            {draftMode === 'autosaving' ? (
              <span className="inline-flex items-center gap-1 text-sky-600">
                <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                Speichert automatisch…
              </span>
            ) : draftMode === 'none' ? (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <Check className="h-2.5 w-2.5" />
                Gespeichert
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <FileWarning className="h-2.5 w-2.5" />
                Auto-Save in 1s…
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

  // ============ Gesprächsdauer (manuell + Live-Timer) ============
  const [durationMin, setDurationMin] = useState('')
  const [durationSec, setDurationSec] = useState('')
  const [timerRunning, setTimerRunning] = useState(false)
  const timerRef = useRef<number | null>(null)
  const [elapsedLive, setElapsedLive] = useState(0)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  const totalSeconds = (() => {
    if (timerRunning || elapsedLive > 0) return elapsedLive
    const m = Number(durationMin) || 0
    const s = Number(durationSec) || 0
    return m * 60 + s
  })()

  function startLiveTimer() {
    if (timerRunning) return
    setTimerRunning(true)
    setElapsedLive(0)
    setDurationMin('')
    setDurationSec('')
    timerRef.current = window.setInterval(() => {
      setElapsedLive((p) => p + 1)
    }, 1000)
  }
  function stopLiveTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setTimerRunning(false)
    const total = elapsedLive
    setDurationMin(String(Math.floor(total / 60)))
    setDurationSec(String(total % 60).padStart(2, '0'))
  }
  function resetLiveTimer() {
    stopLiveTimer()
    setElapsedLive(0)
    setDurationMin('')
    setDurationSec('')
  }

  const displayMm = timerRunning
    ? String(Math.floor(elapsedLive / 60)).padStart(2, '0')
    : durationMin !== ''
      ? String(Number(durationMin) || 0).padStart(2, '0')
      : '00'
  const displaySs = timerRunning
    ? String(elapsedLive % 60).padStart(2, '0')
    : durationSec !== ''
      ? String(Number(durationSec) || 0).padStart(2, '0')
      : '00'

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!dateVal) e.date = 'Datum erforderlich'
    if (!timeVal) e.time = 'Uhrzeit erforderlich'
    if (noteVal.length > 2000) e.notes = 'Max. 2000 Zeichen'
    if ((durationMin !== '' && Number.isNaN(Number(durationMin))) || (durationSec !== '' && Number.isNaN(Number(durationSec)))) {
      e.duration = 'Ungültige Dauer'
    }
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
          <div className="text-[11px] text-slate-500 leading-tight">Dokumentiere das Gesprächsergebnis + Dauer</div>
        </div>
      </div>
      <form
        action={(fd) => {
          if (!validate()) return
          if (totalSeconds > 0) {
            fd.set('call_duration_seconds', String(totalSeconds))
          }
          formAction(fd)
        }}
        className="space-y-2"
      >
        <input type="hidden" name="leadId" value={leadId} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

        {/* ============ Gesprächsdauer ============ */}
        <div className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-blue-50/40 via-white to-indigo-50/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] uppercase tracking-widest text-slate-500 font-medium flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-slate-400" />
              Gesprächsdauer
            </Label>
            <div className="flex items-center gap-1.5">
              {!timerRunning ? (
                <button
                  type="button"
                  onClick={startLiveTimer}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 transition"
                >
                  <Timer className="h-3 w-3" /> Starten
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopLiveTimer}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 text-[10px] font-medium text-rose-700 hover:bg-rose-100 transition"
                >
                  <TimerOff className="h-3 w-3" /> Stoppen
                </button>
              )}
              {(elapsedLive > 0 || durationMin !== '' || durationSec !== '') && (
                <button
                  type="button"
                  onClick={resetLiveTimer}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-500 hover:bg-slate-50 transition"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-xl tabular-nums font-bold tracking-wider transition',
                timerRunning
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm pulse-dot-ring'
                  : totalSeconds > 0
                    ? 'border-indigo-200 bg-white text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-400',
              )}
            >
              {displayMm}:{displaySs}
              <span className="text-[9px] font-sans uppercase tracking-wider opacity-60 ml-1">mm:ss</span>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-1.5">
              <div className="space-y-0.5">
                <Label htmlFor={`ca-mm-${leadId}`} className="text-[9px] uppercase tracking-widest text-slate-400 font-medium pl-0.5">
                  Min.
                </Label>
                <Input
                  id={`ca-mm-${leadId}`}
                  type="number"
                  min={0}
                  step={1}
                  value={durationMin}
                  disabled={timerRunning}
                  onChange={(e) => {
                    setDurationMin(e.target.value)
                    setElapsedLive(0)
                  }}
                  placeholder="0"
                  className="h-8 text-xs tabular-nums"
                />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor={`ca-ss-${leadId}`} className="text-[9px] uppercase tracking-widest text-slate-400 font-medium pl-0.5">
                  Sek.
                </Label>
                <Input
                  id={`ca-ss-${leadId}`}
                  type="number"
                  min={0}
                  max={59}
                  step={1}
                  value={durationSec}
                  disabled={timerRunning}
                  onChange={(e) => {
                    setDurationSec(e.target.value)
                    setElapsedLive(0)
                  }}
                  placeholder="0"
                  className="h-8 text-xs tabular-nums"
                />
              </div>
            </div>
          </div>

          {totalSeconds >= 60 && (
            <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" />
              Umgerechnet:{' '}
              <span className="font-semibold text-slate-700 tabular-nums">
                {(totalSeconds / 60).toFixed(1).replace('.', ',')} Min.
              </span>
              {totalSeconds >= 300 && <span className="text-amber-600">· langes Gespräch</span>}
            </div>
          )}
          {errors.duration && <div className="text-[9px] text-red-600 leading-tight">{errors.duration}</div>}
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
          {totalSeconds > 0 && (
            <span className="ml-1.5 inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 tabular-nums">
              {displayMm}:{displaySs}
            </span>
          )}
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

/* ---------- Lead Storno beantragen (Verkäufer) ---------- */
export function CancellationRequestCard({
  leadId,
  cancellation,
  role,
}: {
  leadId: string
  cancellation: any
  role: string
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => {
      const res = (await sellerRequestCancellationAction(fd)) as any
      if (!res?.error) {
        setOpen(false)
      }
      return res
    },
    null,
  )
  useActionFeedback(state, { saveLabel: 'Storno-Antrag wurde gestellt.' })

  const hasCancellation = !!cancellation
  const status = cancellation?.status as string | undefined
  const reason = cancellation?.reason as string
  const reviewNotes = cancellation?.review_notes as string | undefined
  const createdAt = cancellation?.created_at as string | undefined
  const reviewedAt = cancellation?.reviewed_at as string | undefined
  const canRequestNew =
    status === 'rejected' || status === 'approved' || !status

  const statusBadge = () => {
    if (!status) return null
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
          <Clock className="h-2.5 w-2.5 animate-pulse" />
          Ausstehend · wartet auf Admin
        </span>
      )
    }
    if (status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          <CheckCircle2 className="h-2.5 w-2.5" />
          Genehmigt
        </span>
      )
    }
    if (status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
          <XCircle className="h-2.5 w-2.5" />
          Abgelehnt
        </span>
      )
    }
    return null
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
            <Ban className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800 tracking-tight leading-tight">
              Lead stornieren
            </div>
            <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
              {role === 'seller'
                ? '4-Augen-Prinzip · Admin-Genehmigung erforderlich'
                : 'Storno-Status des Verkäufers'}
            </div>
          </div>
        </div>
        {statusBadge()}
      </div>

      {!hasCancellation && role === 'seller' ? (
        <>
          <div className="rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-2 text-[11px] text-amber-700 space-y-1">
            <div className="font-semibold flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Vor dem Antrag prüfen:
            </div>
            <ul className="list-disc list-inside space-y-0.5 ml-0.5">
              <li>Kontaktversuche & Rückrufe dokumentiert?</li>
              <li>Lead ist wirklich nicht mehr bearbeitbar?</li>
              <li>Genaue Begründung formulieren (Storno-Grund).</li>
            </ul>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition"
              >
                <Ban className="h-3.5 w-3.5" />
                Storno beantragen
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-rose-500" />
                  Storno-Antrag für Lead {leadId.slice(0, 8)}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Der Antrag wird an alle Administratoren weitergeleitet. Erst nach
                  ausdrücklicher Genehmigung wird der Lead storniert und ggf. eine Token-Rückerstattung
                  durchgeführt.
                </DialogDescription>
              </DialogHeader>
              <form
                action={formAction}
                onSubmit={(e) => {
                  const fd = new FormData(e.currentTarget)
                  const reason = String(fd.get('reason') ?? '').trim()
                  if (reason.length < 15) {
                    e.preventDefault()
                    return
                  }
                  const confirmed = (e.currentTarget.elements.namedItem('confirm') as any)?.checked
                  if (!confirmed) e.preventDefault()
                }}
                className="space-y-3 pt-1"
              >
                <input type="hidden" name="leadId" value={leadId} />
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
                    Begründung <span className="text-rose-500">*</span>
                  </Label>
                  <Textarea
                    name="reason"
                    required
                    minLength={15}
                    rows={4}
                    placeholder="Bitte genau beschreiben, warum dieser Lead storniert werden soll…"
                    className="resize-none text-sm"
                  />
                </div>
                <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] text-rose-700 flex items-start gap-1.5">
                  <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>
                    Mit dem Antrag akzeptierst du, dass eine Rückerstattung von Tokens
                    ausschließlich durch einen Admin geprüft und freigegeben wird.
                  </span>
                </div>
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="confirm"
                    required
                    defaultChecked={false}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 accent-rose-600"
                  />
                  <span className="text-[11px] text-slate-600 leading-snug">
                    Ich bestätige, dass ich alle erforderlichen Kontaktversuche
                    dokumentiert habe und der Lead nach Genehmigung für mich nicht
                    mehr sichtbar ist.
                  </span>
                </label>
                {state?.error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 fade-slide-up">
                    {state.error}
                  </div>
                )}
                <DialogFooter className="gap-2 pt-1">
                  <DialogClose asChild>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Abbrechen
                    </button>
                  </DialogClose>
                  <SubmitButton variant="destructive" size="sm" className="h-9 min-w-[130px]">
                    <Ban className="h-3.5 w-3.5" />
                    Antrag senden
                  </SubmitButton>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      ) : null}

      {hasCancellation && (
        <div className="space-y-2.5 border-t border-slate-100 pt-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Eingereicht:</span>
            <span className="tabular-nums text-slate-700">
              {createdAt ? new Date(createdAt).toLocaleString('de-DE') : '-'}
            </span>
          </div>
          {reviewedAt && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Bearbeitet:</span>
              <span className="tabular-nums text-slate-700">
                {new Date(reviewedAt).toLocaleString('de-DE')}
              </span>
            </div>
          )}
          <div className="space-y-1 rounded-md bg-slate-50 border border-slate-100 p-2.5">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
              Meine Begründung
            </div>
            <div className="text-[12px] text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
              {reason}
            </div>
          </div>
          {status === 'rejected' && reviewNotes && (
            <div className="space-y-1 rounded-md border border-red-100 bg-red-50 p-2.5">
              <div className="text-[10px] uppercase tracking-widest text-red-500 font-semibold flex items-center gap-1">
                <XCircle className="h-3 w-3" /> Admin-Antwort (Abgelehnt)
              </div>
              <div className="text-[12px] text-red-700 leading-relaxed whitespace-pre-wrap break-words">
                {reviewNotes}
              </div>
            </div>
          )}
          {status === 'approved' && reviewNotes && (
            <div className="space-y-1 rounded-md border border-emerald-100 bg-emerald-50 p-2.5">
              <div className="text-[10px] uppercase tracking-widest text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Admin-Anmerkung
              </div>
              <div className="text-[12px] text-emerald-800 leading-relaxed whitespace-pre-wrap break-words">
                {reviewNotes}
              </div>
            </div>
          )}
          {status === 'pending' && (
            <div className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-700">
              <ShieldCheck className="h-3.5 w-3.5 animate-pulse" />
              Warte auf Freigabe durch Administrator…
            </div>
          )}
          {canRequestNew && role === 'seller' && (status === 'rejected' || status === 'approved') && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  {status === 'approved' ? (
                    <>Erneut Storno beantragen?</>
                  ) : (
                    <>Neuer Storno-Antrag stellen</>
                  )}
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <Ban className="h-4 w-4 text-rose-500" />
                    Neuer Storno-Antrag
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Der bisherige{' '}
                    <span className="font-semibold">
                      {status === 'approved' ? 'genehmigte' : 'abgelehnte'}
                    </span>{' '}
                    Antrag bleibt bestehen. Mit dem neuen Antrag kannst du eine
                    erneute Prüfung anfragen.
                  </DialogDescription>
                </DialogHeader>
                <form action={formAction} className="space-y-3 pt-1">
                  <input type="hidden" name="leadId" value={leadId} />
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
                      Neue Begründung <span className="text-rose-500">*</span>
                    </Label>
                    <Textarea
                      name="reason"
                      required
                      minLength={15}
                      rows={4}
                      placeholder="Bitte präzisiere, warum erneut ein Storno gewünscht ist…"
                      className="resize-none text-sm"
                    />
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="confirm"
                      required
                      defaultChecked={false}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 accent-rose-600"
                    />
                    <span className="text-[11px] text-slate-600 leading-snug">
                      Ich bestätige, dass die Begründung wahrheitsgemäß ist.
                    </span>
                  </label>
                  {state?.error && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 fade-slide-up">
                      {state.error}
                    </div>
                  )}
                  <DialogFooter className="gap-2 pt-1">
                    <DialogClose asChild>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Abbrechen
                      </button>
                    </DialogClose>
                    <SubmitButton variant="destructive" size="sm" className="h-9">
                      <Ban className="h-3.5 w-3.5" />
                      Neuen Antrag senden
                    </SubmitButton>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- Timeline Icons (Kleinkram) ---------- */
export const Icons = { Layers, Phone, CalendarDays, Clock }
