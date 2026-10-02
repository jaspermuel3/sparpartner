'use client'

import { useState, useEffect } from 'react'
import { useFormState } from 'react-dom'
import {
  createSellerAction,
  updateSellerAction,
  toggleSellerActiveAction,
  resetSellerPasswordAction,
  addTokensToSellerAction,
  subtractTokensFromSellerAction,
  createSellerWithTeamAction,
  updateSellerWithTeamAction,
  createTeamAction,
  bulkCreditTokensAction,
  deleteSellerAction,
  restoreSellerAction,
  updateSellerEmailAction,
  generateMagicLinkAction,
  bulkDeactivateAction,
} from '@/app/actions'
import { SubmitButton, useActionFeedback, type ActionResult } from '@/components/ui-custom/FormHelpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  Plus, UserPlus, Coins, KeyRound, Ban, CheckCircle2, Users, Palette, Pencil, ShieldCheck,
  Trash2, Undo2, Copy, Mail, Phone, FileText, AlertTriangle, CalendarDays, LogIn, Loader2,
} from 'lucide-react'

/* -------- Create User -------- */
export function CreateSellerDialog({ teams }: { teams?: any[] }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await createSellerWithTeamAction(fd)) as any,
    null,
  )
  useActionFeedback(state)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1.5" /> Benutzer erstellen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Neuer Benutzer</DialogTitle>
          <DialogDescription>
            Benutzerkonto mit gewählter Rolle anlegen. Eine Einladungs-E-Mail wird automatisch versandt.
            Ein Token-Wallet wird automatisch erstellt.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Name</Label>
              <Input name="full_name" required placeholder="Max Mustermann" />
            </div>
            <div className="space-y-1.5">
              <Label>Rolle</Label>
              <Select name="role" defaultValue="seller">
                <SelectTrigger>
                  <SelectValue placeholder="Rolle wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seller">Verkäufer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>E-Mail</Label>
              <Input name="email" type="email" required placeholder="max@unternehmen.de" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs text-blue-700 flex items-start gap-2">
                <svg className="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Der Empfänger erhält eine Einladung per E-Mail und kann sein Passwort selbst festlegen.</span>
              </div>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Startguthaben (Tokens)</Label>
              <Input name="initial_balance" type="number" min={0} defaultValue={50} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Team (optional)</Label>
              <Select name="team_id">
                <SelectTrigger>
                  <SelectValue placeholder="Kein Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Kein Team</SelectItem>
                  {(teams ?? []).map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.color ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: t.color }}
                          />
                          {t.name}
                        </span>
                      ) : (
                        t.name
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <DialogFooter>
            <SubmitButton>
              <UserPlus className="h-4 w-4 mr-1.5" /> Konto erstellen
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* -------- Token Dialog (add/subtract) -------- */
export function TokenDialog({
  seller,
  mode,
}: {
  seller: any
  mode: 'add' | 'subtract'
}) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) =>
      mode === 'add'
        ? ((await addTokensToSellerAction(fd)) as any)
        : ((await subtractTokensFromSellerAction(fd)) as any),
    null,
  )
  useActionFeedback(state)
  const add = mode === 'add'
  const toneCls = add
    ? 'hover:bg-emerald-50 hover:border-emerald-200 text-emerald-700'
    : 'hover:bg-red-50 hover:border-red-200 text-red-700'
  const Icon = add ? Plus : Ban
  const tip = add ? 'Tokens gutschreiben' : 'Tokens abziehen'
  return (
    <Dialog>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn('h-9 w-9 !p-0 border-slate-200 shadow-sm hover:shadow transition-all', toneCls)}
              title={tip}
            >
              <Icon className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          <span className="text-[11px] font-medium">{tip}</span>
        </TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {add ? 'Tokens gutschreiben' : 'Tokens abziehen'} — {seller.full_name ?? seller.email}
          </DialogTitle>
          <DialogDescription>
            Aktuelles Guthaben:{' '}
            <span className="font-semibold text-slate-800">{seller.wallet?.balance ?? 0}</span> Tokens.
            Gib einen Grund an.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="userId" value={seller.id} />
          <input type="hidden" name="type" value="aufladung" />
          <div className="space-y-1.5">
            <Label>Anzahl Tokens</Label>
            <Input name="amount" type="number" min={1} defaultValue={add ? 50 : 10} required />
          </div>
          <div className="space-y-1.5">
            <Label>Grund</Label>
            <Input name="reason" defaultValue={add ? 'Aufladung' : 'Korrektur'} required />
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <DialogFooter>
            <SubmitButton variant={add ? 'default' : 'destructive'} size="sm">
              {add ? 'Gutschreiben' : 'Abziehen'}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* -------- Toggle Active Button (mit Grund bei Deaktivierung) -------- */
export function ToggleActiveButton({ seller }: { seller: any }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await toggleSellerActiveAction(fd)) as any,
    null,
  )
  useActionFeedback(state)
  const active = !!seller.is_active
  const tip = active ? 'Benutzer deaktivieren' : 'Benutzer aktivieren'

  // Bei Deaktivierung: Modal mit Grund
  if (!active) {
    return (
      <form action={formAction} className="m-0">
        <input type="hidden" name="userId" value={seller.id} />
        <input type="hidden" name="active" value="true" />
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <SubmitButton
              variant="outline"
              size="sm"
              className={cn(
                'h-9 w-9 !p-0 border-slate-200 shadow-sm hover:shadow hover:bg-emerald-50 hover:border-emerald-200 text-emerald-700 transition-all',
              )}
              pendingLabel="…"
            >
              <CheckCircle2 className="h-4 w-4" />
            </SubmitButton>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>
            <span className="text-[11px] font-medium">{tip}</span>
          </TooltipContent>
        </Tooltip>
      </form>
    )
  }

  // Aktiv → Deaktivieren: Mit Dialog + Grund
  return (
    <Dialog>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 !p-0 border-slate-200 text-red-700 shadow-sm hover:shadow hover:bg-red-50 hover:border-red-200 transition-all"
              title={tip}
            >
              <Ban className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          <span className="text-[11px] font-medium">{tip}</span>
        </TooltipContent>
      </Tooltip>
      <DialogContent>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="userId" value={seller.id} />
          <input type="hidden" name="active" value="false" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Benutzer deaktivieren
            </DialogTitle>
            <DialogDescription>
              {seller.full_name ?? seller.email} wird vorübergehend deaktiviert.
              Die Anmeldung ist danach nicht mehr möglich.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Grund (optional)</Label>
            <Textarea
              name="reason"
              rows={3}
              placeholder="z. B. Kündigung, Urlaub, Audit..."
              defaultValue={seller.deactivation_reason ?? ''}
            />
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Hinweis:</strong> Wenn dies der letzte aktive Admin ist, wird die Aktion blockiert.
            </span>
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Abbrechen</Button>
            </DialogClose>
            <SubmitButton variant="destructive" size="sm">Deaktivieren</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* -------- Edit User (erweitert: Email, Telefon, Notizen, Admin-Rollen-Bestätigung) -------- */
export function EditSellerDialog({ seller, teams }: { seller: any; teams?: any[] }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => {
      // Email separat behandeln
      const email = fd.get('email')?.toString().trim()
      if (email && email.toLowerCase() !== String(seller.email ?? '').toLowerCase()) {
        const res = await updateSellerEmailAction(fd)
        if ((res as any).error) return res
      }
      return (await updateSellerWithTeamAction(fd)) as any
    },
    null,
  )
  useActionFeedback(state)

  const [role, setRole] = useState<string>(seller.role ?? 'seller')
  const isDowngradeAdmin = seller.role === 'admin' && role === 'seller'

  return (
    <Dialog>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 !p-0 border-slate-200 text-slate-700 shadow-sm hover:shadow hover:bg-slate-50 hover:border-slate-300 transition-all"
              title="Benutzer bearbeiten"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          <span className="text-[11px] font-medium">Benutzer bearbeiten</span>
        </TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Benutzer bearbeiten</DialogTitle>
          <DialogDescription>
            {seller.full_name ?? seller.email} · {seller.email}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="userId" value={seller.id} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Name</Label>
              <Input name="full_name" defaultValue={seller.full_name ?? ''} />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                E-Mail-Adresse
              </Label>
              <Input
                name="email"
                type="email"
                defaultValue={seller.email ?? ''}
              />
              <p className="text-[11px] text-slate-500 leading-tight">
                Wird in Supabase Auth aktualisiert (mit E-Mail-Bestätigung).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                Telefon
              </Label>
              <Input
                name="phone"
                type="tel"
                placeholder="+49 ..."
                defaultValue={seller.phone ?? ''}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Rolle</Label>
              <Select
                name="role"
                defaultValue={seller.role ?? 'seller'}
                onValueChange={setRole}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Rolle wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seller">Verkäufer</SelectItem>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                      Admin
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {isDowngradeAdmin && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-2.5 py-1.5 text-[11px] text-amber-700 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Achtung:</strong> Admin → Verkäufer. Letzter Admin wird automatisch geschützt.
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Team (optional)</Label>
              <Select name="team_id" defaultValue={seller.team_id ? String(seller.team_id) : ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Kein Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Kein Team</SelectItem>
                  {(teams ?? []).map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.color ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: t.color }}
                          />
                          {t.name}
                        </span>
                      ) : (
                        t.name
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                Interne Notizen (Admin)
              </Label>
              <Textarea
                name="notes"
                rows={3}
                placeholder="Private Notizen zu diesem Benutzer (nur für Admins sichtbar)."
                defaultValue={seller.notes ?? ''}
              />
            </div>
          </div>

          {/* Account-Infos */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <InfoRow icon={<CalendarDays className="h-3.5 w-3.5 text-slate-400" />} label="Erstellt am">
              {seller.created_at
                ? new Date(seller.created_at).toLocaleDateString('de-DE', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                  })
                : '—'}
            </InfoRow>
            <InfoRow icon={<CalendarDays className="h-3.5 w-3.5 text-slate-400" />} label="Letzter Login">
              {seller.last_login_at
                ? new Date(seller.last_login_at).toLocaleString('de-DE', {
                    day: '2-digit', month: '2-digit', year: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  })
                : 'Nie'}
            </InfoRow>
            <InfoRow icon={<ShieldCheck className="h-3.5 w-3.5 text-slate-400" />} label="Status">
              {seller.is_deleted ? 'Gelöscht' : seller.is_active ? 'Aktiv' : 'Deaktiviert'}
            </InfoRow>
            <InfoRow icon={<Coins className="h-3.5 w-3.5 text-amber-500" />} label="Wallet">
              {seller.wallet?.balance ?? 0} Tokens
            </InfoRow>
          </div>

          {seller.deactivation_reason && (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">
                Grund letzte Deaktivierung
              </div>
              <div className="text-xs text-slate-700">{seller.deactivation_reason}</div>
            </div>
          )}

          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <DialogFooter>
            <SubmitButton size="sm">
              <Pencil className="h-4 w-4 mr-1.5" /> Speichern
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function InfoRow({
  icon, label, children,
}: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {icon} {label}
      </div>
      <div className="text-xs text-slate-800 truncate">{children}</div>
    </div>
  )
}

/* -------- Reset Password -------- */
export function ResetPwdDialog({ seller }: { seller: any }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await resetSellerPasswordAction(fd)) as any,
    null,
  )
  useActionFeedback(state)
  return (
    <Dialog>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 !p-0 border-slate-200 text-slate-700 shadow-sm hover:shadow hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-all"
              title="Passwort zurücksetzen"
            >
              <KeyRound className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          <span className="text-[11px] font-medium">Passwort zurücksetzen</span>
        </TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Passwort zurücksetzen</DialogTitle>
          <DialogDescription>
            Neues Passwort für {seller.full_name ?? seller.email} festlegen.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="userId" value={seller.id} />
          <div className="space-y-1.5">
            <Label>Neues Passwort</Label>
            <Input name="password" type="text" minLength={6} defaultValue="Neu12345!" />
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <DialogFooter>
            <SubmitButton size="sm">Passwort setzen</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* -------- Create Team Dialog -------- */
export function CreateTeamDialog({
  triggerButton,
}: {
  triggerButton?: React.ReactNode
}) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await createTeamAction(fd)) as any,
    null,
  )
  useActionFeedback(state)

  return (
    <Dialog>
      <DialogTrigger asChild>
        {triggerButton ?? (
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4 mr-1.5" /> Team erstellen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neues Team erstellen</DialogTitle>
          <DialogDescription>
            Gruppen für Verkäufer definieren und mit Farbe markieren.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Team-Name</Label>
            <Input name="name" required placeholder="z. B. Vertrieb Nord" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-slate-400" /> Farbe (optional)
            </Label>
            <div className="flex gap-2 items-center">
              <Input
                name="color"
                type="color"
                defaultValue="#6366f1"
                className="h-10 w-16 p-1 cursor-pointer"
              />
              <span className="text-xs text-slate-500">
                Wird als Indikator in Listen angezeigt.
              </span>
            </div>
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <DialogFooter>
            <SubmitButton>
              <Plus className="h-4 w-4 mr-1.5" /> Team speichern
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* -------- Bulk Token Button + Dialog -------- */
export function BulkTokenButton({ disabled }: { disabled?: boolean }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await bulkCreditTokensAction(fd)) as any,
    null,
  )
  useActionFeedback(state)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" disabled={disabled}>
          <Coins className="h-4 w-4 mr-1.5" /> Massen-Aufladung
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tokens Massen-Aufladung</DialogTitle>
          <DialogDescription>
            Tokens für alle ausgewählten Verkäufer gleichzeitig gutgeschrieben.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="selectedIds" id="bulkSelectedIds" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Hinweis</Label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Es werden Tokens für die aktuell ausgewählten Verkäufer (Checkboxen in der
                Tabelle) aufgeladen. Stelle sicher, dass mindestens einer ausgewählt ist.
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Anzahl pro Verkäufer</Label>
              <Input name="amount" type="number" min={1} defaultValue={50} required />
            </div>
            <div className="space-y-1.5">
              <Label>Grund</Label>
              <Input name="reason" defaultValue="Massen-Aufladung" />
            </div>
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <DialogFooter>
            <SubmitButton>
              <Coins className="h-4 w-4 mr-1.5" /> Aufladen
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* -------- Delete Seller Dialog -------- */
export function DeleteSellerDialog({ seller }: { seller: any }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await deleteSellerAction(fd)) as any,
    null,
  )
  useActionFeedback(state)

  return (
    <Dialog>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 !p-0 border-slate-200 text-slate-700 shadow-sm hover:shadow hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 transition-all"
              title="Benutzer löschen"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          <span className="text-[11px] font-medium">Benutzer löschen</span>
        </TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
            Benutzer endgültig löschen?
          </DialogTitle>
          <DialogDescription>
            Diese Aktion kann rückgängig gemacht werden (Soft-Delete), jedoch wird der Zugang
            sofort gesperrt.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="userId" value={seller.id} />
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-1.5">
            <div className="flex items-start gap-2 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
              <div className="space-y-0.5">
                <div>
                  <strong>Wichtige Hinweise:</strong>
                </div>
                <ul className="list-disc list-inside space-y-0.5 ml-0.5">
                  <li>
                    Der Benutzer wird als <strong>gelöscht markiert</strong> und in der
                    Standard-Ansicht ausgeblendet.
                  </li>
                  <li>
                    Der Login in Supabase Auth wird <strong>permanent gesperrt</strong> (Ban).
                  </li>
                  <li>
                    <strong>Letzter-Admin-Schutz:</strong> Falls dies der letzte aktive Admin
                    ist, wird die Aktion blockiert.
                  </li>
                  <li>
                    <strong>Selbst-Lösch-Schutz:</strong> Du kannst dich nicht selbst löschen.
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center gap-2.5">
            <div
              className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-sm flex-shrink-0',
                seller.role === 'admin' ? 'bg-gradient-to-br from-indigo-500 to-indigo-700' : 'bg-gradient-to-br from-slate-500 to-slate-700',
              )}
            >
              {(seller.full_name ?? seller.email ?? '?').toString().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-800 truncate">
                {seller.full_name ?? 'Unbenannter Benutzer'}
              </div>
              <div className="text-xs text-slate-500 truncate">{seller.email}</div>
            </div>
            <Badge variant={seller.role === 'admin' ? 'default' : 'secondary'} className="flex-shrink-0">
              {seller.role === 'admin' ? 'Admin' : 'Verkäufer'}
            </Badge>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-400" /> Grund der Löschung
              <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Textarea
              name="reason"
              rows={2}
              placeholder="z. B. Kündigung, Falscher Account, Duplikat, Audit..."
            />
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Abbrechen
              </Button>
            </DialogClose>
            <SubmitButton variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-1.5" /> Endgültig löschen
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* -------- Restore Seller Dialog -------- */
export function RestoreSellerDialog({ seller }: { seller: any }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await restoreSellerAction(fd)) as any,
    null,
  )
  useActionFeedback(state)

  return (
    <Dialog>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 !p-0 border-emerald-200 text-emerald-700 shadow-sm hover:shadow hover:bg-emerald-50 hover:border-emerald-300 transition-all"
              title="Benutzer wiederherstellen"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          <span className="text-[11px] font-medium text-emerald-700">Wiederherstellen</span>
        </TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-700">
            <Undo2 className="h-5 w-5" />
            Benutzer wiederherstellen?
          </DialogTitle>
          <DialogDescription>
            Die Löschmarkierung wird entfernt, Auth-Sperre aufgehoben und der Benutzer erhält
            wieder vollen Zugriff.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="userId" value={seller.id} />
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-white text-sm font-semibold shadow-sm flex-shrink-0">
              {(seller.full_name ?? seller.email ?? '?').toString().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-800 truncate line-through decoration-rose-400/70 decoration-1">
                {seller.full_name ?? 'Unbenannter Benutzer'}
              </div>
              <div className="text-xs text-slate-500 truncate">{seller.email}</div>
            </div>
            <Badge variant="destructive" className="flex-shrink-0">
              Gelöscht
            </Badge>
          </div>
          {seller.deleted_at && (
            <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
              <CalendarDays className="h-3.5 w-3.5" />
              Gelöscht am{' '}
              {new Date(seller.deleted_at).toLocaleString('de-DE', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </div>
          )}
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Abbrechen
              </Button>
            </DialogClose>
            <SubmitButton variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <Undo2 className="h-4 w-4 mr-1.5" /> Wiederherstellen
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* -------- Magic Link Dialog -------- */
export function MagicLinkDialog({ seller }: { seller: any }) {
  const [link, setLink] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function generateLink() {
    setLoading(true)
    setError(null)
    setLink(null)
    setExpiresAt(null)
    setCopied(false)
    try {
      const fd = new FormData()
      fd.append('userId', seller.id)
      const res = await generateMagicLinkAction(fd) as any
      if (res?.ok && res.link) {
        setLink(res.link)
        setExpiresAt(res.expires_at ?? null)
      } else {
        setError(res?.error ?? 'Fehler beim Generieren des Links')
      }
    } catch (e: any) {
      setError(e?.message ?? 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  async function copyToClipboard() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Konnte nicht in Zwischenablage kopieren')
    }
  }

  return (
    <Dialog>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 !p-0 border-slate-200 text-slate-700 shadow-sm hover:shadow hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all"
              title="Login-Link generieren"
            >
              <LogIn className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          <span className="text-[11px] font-medium">Einmaliger Login-Link</span>
        </TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-indigo-600" />
            Einmaligen Login-Link generieren
          </DialogTitle>
          <DialogDescription>
            Erzeugt einen temporären Magic-Link für <strong>{seller.email}</strong>. Mit diesem
            Link kann sich der Benutzer einmalig ohne Passwort anmelden.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!link && !loading && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 space-y-0.5">
                <div>
                  <strong>Sicherheitshinweis:</strong>
                </div>
                <ul className="list-disc list-inside space-y-0.5 ml-0.5">
                  <li>Der Link ist nur für kurze Zeit gültig (Standard: 1 Stunde).</li>
                  <li>
                    Teile ihn ausschließlich über einen sicheren Kanal (persönlich, Anruf,
                    verschlüsselte Mail) mit dem Benutzer.
                  </li>
                </ul>
              </div>
            </div>
          )}
          {!link && (
            <Button
              onClick={generateLink}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Link wird generiert...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Magic-Link für {seller.full_name ?? seller.email} generieren
                </>
              )}
            </Button>
          )}
          {link && (
            <div className="space-y-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium">
                  Link erfolgreich erstellt!
                  {expiresAt && (
                    <>
                      {' '}Gültig bis{' '}
                      {new Date(expiresAt).toLocaleString('de-DE', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </>
                  )}
                </span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Login-Link</Label>
                <div className="flex gap-2">
                  <Input value={link} readOnly className="font-mono text-xs flex-1 pr-20" />
                </div>
                <div className="flex justify-end mt-1">
                  <Button
                    size="sm"
                    onClick={copyToClipboard}
                    variant={copied ? 'default' : 'outline'}
                    className={cn(
                      copied && 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600',
                    )}
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1.5" /> Kopiert!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1.5" /> In Zwischenablage kopieren
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div className="pt-1">
                <DialogClose asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    Fertig
                  </Button>
                </DialogClose>
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* -------- Bulk Deactivate Button + Dialog -------- */
export function BulkDeactivateButton({ disabled }: { disabled?: boolean }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await bulkDeactivateAction(fd)) as any,
    null,
  )
  useActionFeedback(state)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled} className="border-slate-200 text-slate-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700">
          <Ban className="h-4 w-4 mr-1.5" />
          Massen-Deaktivierung
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <Ban className="h-5 w-5" />
            Ausgewählte Benutzer deaktivieren?
          </DialogTitle>
          <DialogDescription>
            Alle ausgewählten Verkäufer werden gleichzeitig deaktiviert. Admins werden
            automatisch übersprungen – sie können nur einzeln bearbeitet werden.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="selectedIds" id="bulkSelectedIdsDeactivate" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Hinweis</Label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 space-y-1">
                <div>
                  Es werden alle Verkäufer deaktiviert, die aktuell per Checkbox in der
                  Tabelle ausgewählt sind.
                </div>
                <ul className="list-disc list-inside space-y-0.5 ml-0.5 pt-1">
                  <li>Admins werden <strong>ignoriert</strong> (nicht deaktiviert).</li>
                  <li>
                    Bereits deaktivierte Benutzer werden <strong>übersprungen</strong>.
                  </li>
                  <li>Der Grund wird bei jedem Benutzer protokolliert.</li>
                </ul>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                Grund für Massen-Deaktivierung
                <span className="text-slate-400 font-normal">(empfohlen)</span>
              </Label>
              <Textarea
                name="reason"
                rows={2}
                defaultValue="Massen-Deaktivierung (Admin)"
                placeholder="z. B. Inaktive Konten bereinigen, Projektende, Urlaubsvertretung..."
              />
            </div>
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Abbrechen
              </Button>
            </DialogClose>
            <SubmitButton variant="destructive" size="sm">
              <Ban className="h-4 w-4 mr-1.5" /> Alle deaktivieren
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
