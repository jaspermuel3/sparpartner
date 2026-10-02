'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import {
  adminAssignLeadAction,
  adminResetLeadAction,
  adminCreateLeadAction,
  adminToggleHoldAction,
  adminDeleteLeadAction,
} from '@/app/actions'
import { SubmitButton, useActionFeedback, type ActionResult } from '@/components/ui-custom/FormHelpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  UserPlus, RotateCcw, Plus, Snowflake, Trash2
} from 'lucide-react'
import { PRODUCT_LABELS, SOURCE_LABELS } from '@/lib/constants'

/* ---------------- Assign Dialog ---------------- */

export function AssignLeadDialog({
  leadId,
  sellers,
  compact,
}: {
  leadId: string
  sellers: any[]
  compact?: boolean
}) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await adminAssignLeadAction(fd)) as any,
    null,
  )
  useActionFeedback(state)

  return (
    <Dialog>
      <DialogTrigger asChild>
        {compact ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            title="Lead zuweisen"
            aria-label="Lead zuweisen"
          >
            <UserPlus className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-8">
            <UserPlus className="h-3.5 w-3.5 mr-1" /> Zuweisen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lead zuweisen</DialogTitle>
          <DialogDescription>
            Wähle den Verkäufer und lege fest, ob 1 Token von dessen Guthaben abgebucht wird.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="leadId" value={leadId} />
          <div className="space-y-1.5">
            <Label>Verkäufer wählen</Label>
            <Select name="sellerId" defaultValue="">
              <SelectTrigger>
                <SelectValue placeholder="Verkäufer auswählen" />
              </SelectTrigger>
              <SelectContent>
                {sellers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center justify-between gap-3 pr-2 w-full">
                      <span>{s.full_name ?? s.email}</span>
                      <span className="ml-3 text-xs text-slate-500">
                        {s.wallet?.balance ?? 0} Tokens
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="debitTokens"
                value="on"
                defaultChecked
                className="mt-0.5"
              />
              <div>
                <div className="font-medium text-slate-800">1 Token vom Verkäufer abbuchen</div>
                <div className="text-xs text-slate-500">
                  Haken entfernen, um den Lead kostenlos zuzuweisen (keine Token-Transaktion).
                </div>
              </div>
            </label>
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {typeof state.error === 'string'
                ? state.error
                : 'Es ist ein Fehler aufgetreten.'}
            </div>
          )}
          <DialogFooter>
            <SubmitButton variant="default" size="sm">
              <UserPlus className="h-4 w-4 mr-1.5" /> Zuweisen
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Reset Dialog ---------------- */

export function ResetLeadDialog({ leadId, compact }: { leadId: string; compact?: boolean }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await adminResetLeadAction(fd)) as any,
    null,
  )
  useActionFeedback(state)

  return (
    <Dialog>
      <DialogTrigger asChild>
        {compact ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 text-amber-700 border-amber-200 hover:bg-amber-50"
            title="Lead zurücksetzen"
            aria-label="Lead zurücksetzen"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-amber-700 border-amber-200 hover:bg-amber-50"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Zurücksetzen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lead zurücksetzen?</DialogTitle>
          <DialogDescription>
            Der Lead wird wieder als verfügbar markiert. Standardmäßig wird dem Verkäufer das Token
            rückerstattet.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="leadId" value={leadId} />
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" name="refund" value="true" defaultChecked className="mt-0.5" />
              <div>
                <div className="font-medium text-slate-800">Token erstatten</div>
                <div className="text-xs text-slate-500">
                  Gebuchte Tokens werden an den Verkäufer zurückgebucht.
                </div>
              </div>
            </label>
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {typeof state.error === 'string'
                ? state.error
                : 'Es ist ein Fehler aufgetreten.'}
            </div>
          )}
          <DialogFooter>
            <SubmitButton variant="default" size="sm">
              <RotateCcw className="h-4 w-4 mr-1.5" /> Lead zurücksetzen
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Create Lead Dialog ---------------- */

export function CreateLeadDialog({
  campaigns,
  sellers,
}: {
  campaigns?: any[]
  sellers: any[]
}) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await adminCreateLeadAction(fd)) as any,
    null,
  )
  useActionFeedback(state)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-3.5 w-3.5 mr-1" /> Lead anlegen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neuen Lead anlegen</DialogTitle>
          <DialogDescription>
            Alle mit * markierten Felder sind erforderlich. Der Lead wird mit Status "Neu" angelegt.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vorname *</Label>
              <Input name="first_name" placeholder="Max" />
            </div>
            <div className="space-y-1.5">
              <Label>Nachname *</Label>
              <Input name="last_name" placeholder="Mustermann" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telefon *</Label>
              <Input name="phone" placeholder="+49 ..." />
            </div>
            <div className="space-y-1.5">
              <Label>E-Mail</Label>
              <Input name="email" type="email" placeholder="max@example.com" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Straße</Label>
              <Input name="street" placeholder="Musterstraße 1" />
            </div>
            <div className="space-y-1.5">
              <Label>PLZ</Label>
              <Input name="zip" placeholder="12345" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Ort</Label>
            <Input name="city" placeholder="Berlin" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Produkt *</Label>
              <Select name="product" defaultValue="strom">
                <SelectTrigger>
                  <SelectValue placeholder="Produkt wählen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRODUCT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quelle *</Label>
              <Select name="source" defaultValue="manual">
                <SelectTrigger>
                  <SelectValue placeholder="Quelle wählen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kampagne (optional)</Label>
              <Select name="campaign_id" defaultValue="">
                <SelectTrigger>
                  <SelectValue placeholder="Kampagne wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keine Kampagne</SelectItem>
                  {(campaigns ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Stromverbrauch (kWh)</Label>
                <Input name="power_consumption" type="number" placeholder="3500" />
              </div>
              <div className="space-y-1.5">
                <Label>Gasverbrauch (kWh)</Label>
                <Input name="gas_consumption" type="number" placeholder="15000" />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notizen</Label>
            <Textarea name="notes" placeholder="Interne Notizen zum Lead…" rows={3} />
          </div>
          {sellers.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
              <div className="space-y-1.5">
                <Label>Verkäufer zuweisen (optional)</Label>
                <Select name="seller_id" defaultValue="">
                  <SelectTrigger>
                    <SelectValue placeholder="Verkäufer auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Keine Zuweisung</SelectItem>
                    {sellers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center justify-between gap-3 pr-2 w-full">
                          <span>{s.full_name ?? s.email}</span>
                          <span className="ml-3 text-xs text-slate-500">
                            {s.wallet?.balance ?? 0} Tokens
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-start gap-2 cursor-pointer text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="debitTokens"
                  value="on"
                  defaultChecked
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium text-slate-800">1 Token abbuchen</div>
                  <div className="text-xs text-slate-500">
                    Wenn deaktiviert, wird der Lead kostenlos zugewiesen.
                  </div>
                </div>
              </label>
            </div>
          )}
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {typeof state.error === 'string' ? state.error : 'Es ist ein Fehler aufgetreten.'}
            </div>
          )}
          <DialogFooter>
            <SubmitButton variant="default" size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> Lead anlegen
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Delete Lead Dialog ---------------- */

export function DeleteLeadDialog({ leadId, compact }: { leadId: string; compact?: boolean }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await adminDeleteLeadAction(fd)) as any,
    null,
  )
  useActionFeedback(state)

  return (
    <Dialog>
      <DialogTrigger asChild>
        {compact ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 text-red-700 border-red-200 hover:bg-red-50"
            title="Lead löschen"
            aria-label="Lead löschen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-red-700 border-red-200 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Löschen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-600" />
            Lead dauerhaft löschen?
          </DialogTitle>
          <DialogDescription>
            Der Lead wird als gelöscht markiert und aus allen Benutzer-Ansichten entfernt. Datensätze bleiben
            im Audit-Log erhalten. Diese Aktion kann nicht rückgängig gemacht werden.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="leadId" value={leadId} />
          <div className="space-y-1.5">
            <Label>Grund (optional)</Label>
            <Textarea
              name="reason"
              rows={2}
              placeholder="Warum wird dieser Lead gelöscht? z.B. Dublette, Test-Datensatz, Kunde hat sich gemeldet…"
            />
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <div className="font-medium flex items-center gap-1.5">
              <Trash2 className="h-4 w-4" />
              Bestätigung erforderlich
            </div>
            <div className="text-xs text-red-600 mt-1">
              Klicke unten auf „Lead löschen“, um die Aktion endgültig auszuführen.
            </div>
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {typeof state.error === 'string' ? state.error : 'Es ist ein Fehler aufgetreten.'}
            </div>
          )}
          <DialogFooter>
            <SubmitButton variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-1.5" /> Lead löschen
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Hold Lead Dialog ---------------- */

export function HoldLeadDialog({
  leadId,
  isOnHold,
  currentNotes,
  compact,
}: {
  leadId: string
  isOnHold: boolean
  currentNotes?: string | null
  compact?: boolean
}) {
  const [checked, setChecked] = useState(isOnHold)
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await adminToggleHoldAction(fd)) as any,
    null,
  )
  useActionFeedback(state)

  return (
    <Dialog>
      <DialogTrigger asChild>
        {compact ? (
          <Button
            variant="outline"
            size="sm"
            className={
              'h-8 w-8 p-0 ' +
              (isOnHold
                ? 'text-sky-700 border-sky-200 hover:bg-sky-50'
                : 'text-slate-600 border-slate-200')
            }
            title={isOnHold ? 'Hold bearbeiten' : 'Auf Eis legen'}
            aria-label={isOnHold ? 'Hold bearbeiten' : 'Auf Eis legen'}
          >
            <Snowflake className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className={
              'h-8 ' +
              (isOnHold
                ? 'text-sky-700 border-sky-200 hover:bg-sky-50'
                : 'text-slate-600 border-slate-200')
            }
          >
            <Snowflake className="h-3.5 w-3.5 mr-1" />
            {isOnHold ? 'Hold bearbeiten' : 'Auf Eis'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lead auf Eis legen</DialogTitle>
          <DialogDescription>
            Markiere einen Lead als "pausiert". Er bleibt im System, wird aber von
            automatischen Zuweisungen und Fälligkeiten ausgenommen.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="leadId" value={leadId} />
          <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              name="is_on_hold"
              value="on"
              defaultChecked={isOnHold}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <div className="font-medium text-slate-800 text-sm">
                Lead auf Eis legen
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Solange aktiv, wird der Lead in der Übersicht grau dargestellt und
                aus Zuweisungen herausgenommen.
              </div>
            </div>
          </label>
          <div className="space-y-1.5">
            <Label>Grund / Notizen</Label>
            <Textarea
              name="hold_notes"
              defaultValue={currentNotes ?? ''}
              placeholder="Warum wird der Lead auf Eis gelegt? z.B. Urlaub, keine Zeit, Kunde ist krank…"
              rows={3}
            />
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {typeof state.error === 'string' ? state.error : 'Es ist ein Fehler aufgetreten.'}
            </div>
          )}
          <DialogFooter>
            <SubmitButton variant="default" size="sm">
              <Snowflake className="h-4 w-4 mr-1.5" />
              {checked ? 'Als "auf Eis" markieren' : 'Von Eis nehmen'}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
