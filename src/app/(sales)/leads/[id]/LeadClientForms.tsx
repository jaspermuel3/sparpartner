'use client'

import { useFormState } from 'react-dom'
import {
  updateLeadStatusAction,
  updateLeadNotesAction,
  addContactAttemptAction,
  createCallbackAction,
  updateCallbackStatusAction,
} from '@/app/actions'
import { SubmitButton, useActionFeedback, type ActionResult } from '@/components/ui-custom/FormHelpers'
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
} from 'lucide-react'
import {
  LEAD_STATUS_LABELS,
  CONTACT_RESULT_LABELS,
} from '@/lib/constants'
import type { LeadStatus, ContactResult } from '@/types'

/* ---------- Status ---------- */
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
    <>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
          <Pencil className="h-4 w-4 text-slate-400" />
          Status ändern
        </CardTitle>
        <CardDescription className="text-xs">Aktualisiere den Bearbeitungsstand</CardDescription>
      </CardHeader>
      <div className="px-6 pb-6 pt-0 space-y-3">
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="leadId" value={leadId} />
          <div className="space-y-1.5">
            <Label htmlFor="status">Neuer Status</Label>
            <Select name="status" defaultValue={initialStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <SubmitButton variant="default" size="sm" className="w-full">
            <Save className="h-4 w-4" />
            Status speichern
          </SubmitButton>
        </form>
      </div>
    </>
  )
}

/* ---------- Notizen ---------- */
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
  useActionFeedback(state)
  return (
    <>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
          <Pencil className="h-4 w-4 text-slate-400" />
          Notizen
        </CardTitle>
        <CardDescription className="text-xs">Interne Hinweise zum Lead</CardDescription>
      </CardHeader>
      <div className="px-6 pb-6 pt-0 space-y-3">
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="leadId" value={leadId} />
          <Textarea
            name="notes"
            defaultValue={initialNotes}
            placeholder="Notizen zum Gespräch, Besonderheiten, Konditionen…"
            rows={5}
            className="resize-none text-sm"
          />
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <SubmitButton variant="outline" size="sm" className="w-full">
            <Save className="h-4 w-4" />
            Notizen speichern
          </SubmitButton>
        </form>
      </div>
    </>
  )
}

/* ---------- Kontaktversuch ---------- */
export function ContactAttemptForm({ leadId }: { leadId: string }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await addContactAttemptAction(fd)) as any,
    null,
  )
  useActionFeedback(state)
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const results = Object.keys(CONTACT_RESULT_LABELS) as ContactResult[]

  return (
    <>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
          <Phone className="h-4 w-4 text-slate-400" />
          Neuer Kontaktversuch
        </CardTitle>
        <CardDescription className="text-xs">Dokumentiere das Ergebnis des Gesprächs</CardDescription>
      </CardHeader>
      <div className="px-6 pb-6 pt-0">
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="leadId" value={leadId} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ca-date">Datum</Label>
              <Input id="ca-date" type="date" name="date" defaultValue={today} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ca-time">Uhrzeit</Label>
              <Input id="ca-time" type="time" name="time" defaultValue={hhmm} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ca-result">Ergebnis</Label>
            <Select name="result" defaultValue="keine_antwort">
              <SelectTrigger id="ca-result">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {results.map((r) => (
                  <SelectItem key={r} value={r}>
                    {CONTACT_RESULT_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ca-notes">Notiz (optional)</Label>
            <Textarea
              id="ca-notes"
              name="notes"
              rows={2}
              placeholder="Gesprächsinhalt, Konditionen, Bedenken…"
              className="resize-none text-sm"
            />
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <SubmitButton variant="default" className="w-full h-10">
            <Plus className="h-4 w-4" />
            Kontaktversuch speichern
          </SubmitButton>
        </form>
      </div>
    </>
  )
}

/* ---------- Rückruf ---------- */
export function CallbackForm({ leadId }: { leadId: string }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await createCallbackAction(fd)) as any,
    null,
  )
  useActionFeedback(state)
  const tmrw = new Date()
  tmrw.setDate(tmrw.getDate() + 1)
  const today = tmrw.toISOString().slice(0, 10)
  return (
    <>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          Rückruf planen
        </CardTitle>
        <CardDescription className="text-xs">Setze einen Zeitpunkt für den nächsten Kontakt</CardDescription>
      </CardHeader>
      <div className="px-6 pb-6 pt-0">
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="leadId" value={leadId} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cb-date">Datum</Label>
              <Input id="cb-date" type="date" name="date" defaultValue={today} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cb-time">Uhrzeit</Label>
              <Input id="cb-time" type="time" name="time" defaultValue="10:00" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cb-notes">Notiz (optional)</Label>
            <Textarea
              id="cb-notes"
              name="notes"
              rows={2}
              placeholder="Thema, Erinnerung…"
              className="resize-none text-sm"
            />
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <SubmitButton variant="default" className="w-full h-10">
            <CalendarDays className="h-4 w-4" />
            Rückruf speichern
          </SubmitButton>
        </form>
      </div>
    </>
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
