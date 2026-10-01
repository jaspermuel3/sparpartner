'use client'

import { useFormState } from 'react-dom'
import { updateProfileAction } from '@/app/actions'
import { SubmitButton, useActionFeedback, type ActionResult } from '@/components/ui-custom/FormHelpers'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, Save } from 'lucide-react'

export function ProfileForm({ user, email }: { user: any; email: string }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await updateProfileAction(fd)) as any,
    null,
  )
  useActionFeedback(state)
  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="full_name">Name</Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={user.full_name ?? ''}
          placeholder="Max Mustermann"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-Mail</Label>
        <Input id="email" name="email" defaultValue={email} disabled />
        <p className="text-[11px] text-slate-500">E-Mail kann aktuell nicht geändert werden.</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <Lock className="h-4 w-4 text-slate-500" />
          Passwort ändern
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password">Aktuelles Passwort</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password_new">Neues Passwort</Label>
            <Input
              id="password_new"
              name="password_new"
              type="password"
              autoComplete="new-password"
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          Leere beide Felder, wenn du das Passwort unverändert lassen möchtest.
        </p>
      </div>
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      <SubmitButton variant="default" size="sm">
        <Save className="h-4 w-4 mr-1.5" /> Änderungen speichern
      </SubmitButton>
    </form>
  )
}
