'use client'

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
} from '@/app/actions'
import { SubmitButton, useActionFeedback, type ActionResult } from '@/components/ui-custom/FormHelpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Plus, UserPlus, Coins, KeyRound, Ban, CheckCircle2, Users, Palette, Pencil, ShieldCheck } from 'lucide-react'

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

/* -------- Toggle Active Button -------- */
export function ToggleActiveButton({ seller }: { seller: any }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await toggleSellerActiveAction(fd)) as any,
    null,
  )
  useActionFeedback(state)
  const active = !!seller.is_active
  const tip = active ? 'Benutzer deaktivieren' : 'Benutzer aktivieren'
  return (
    <form action={formAction} className="m-0">
      <input type="hidden" name="userId" value={seller.id} />
      <input type="hidden" name="active" value={active ? 'false' : 'true'} />
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <SubmitButton
            variant="outline"
            size="sm"
            className={cn(
              'h-9 w-9 !p-0 border-slate-200 shadow-sm hover:shadow transition-all',
              active
                ? 'text-red-700 hover:bg-red-50 hover:border-red-200'
                : 'text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200',
            )}
            pendingLabel="…"
          >
            {active ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </SubmitButton>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          <span className="text-[11px] font-medium">{tip}</span>
        </TooltipContent>
      </Tooltip>
    </form>
  )
}

/* -------- Edit User -------- */
export function EditSellerDialog({ seller, teams }: { seller: any; teams?: any[] }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await updateSellerWithTeamAction(fd)) as any,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Benutzer bearbeiten</DialogTitle>
          <DialogDescription>Aktuell: {seller.full_name ?? seller.email}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="userId" value={seller.id} />
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input name="full_name" defaultValue={seller.full_name ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label>Rolle</Label>
            <Select name="role" defaultValue={seller.role ?? 'seller'}>
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
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <DialogFooter>
            <SubmitButton size="sm">Speichern</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
