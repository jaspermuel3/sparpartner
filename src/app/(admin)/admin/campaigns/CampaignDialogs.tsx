'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import { createCampaignAction, updateCampaignAction } from '@/app/actions'
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
import { SOURCE_LABELS } from '@/lib/constants'
import { Plus, Pencil } from 'lucide-react'

export const CampaignDialogs = {
  Create: CreateCampaignDialog,
  Edit: EditCampaignDialog,
}

function CreateCampaignDialog({ campaigns }: { campaigns?: any[] }) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => {
      const res = await (createCampaignAction as any)(fd)
      if (res?.ok) setOpen(false)
      return res as any
    },
    null,
  )
  useActionFeedback(state)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-3.5 w-3.5 mr-1" /> Kampagne anlegen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neue Kampagne anlegen</DialogTitle>
          <DialogDescription>
            Definiere Name, Quelle, Budget und Laufzeit.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input name="name" placeholder="z.B. Meta Ads Q4" />
          </div>
          <div className="space-y-1.5">
            <Label>Quelle</Label>
            <Select name="source" defaultValue="">
              <SelectTrigger>
                <SelectValue placeholder="Quelle wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Keine Quelle</SelectItem>
                {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <input type="checkbox" name="is_active" value="on" defaultChecked className="mt-0.5" />
            <div>
              <div className="font-medium text-slate-800">Kampagne aktiv</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Nur aktive Kampagnen werden bei Lead-Imports berücksichtigt.
              </div>
            </div>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-3">
              <Label>Budget (€)</Label>
              <Input name="budget_amount" type="number" placeholder="5000" />
            </div>
            <div className="space-y-1.5">
              <Label>Startdatum</Label>
              <Input name="start_date" type="date" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Enddatum</Label>
              <Input name="end_date" type="date" />
            </div>
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {typeof state.error === 'string' ? state.error : 'Fehler'}
            </div>
          )}
          <DialogFooter>
            <SubmitButton size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> Kampagne speichern
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditCampaignDialog({ campaign }: { campaign: any }) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => {
      const res = await (updateCampaignAction as any)(fd)
      if (res?.ok) setOpen(false)
      return res as any
    },
    null,
  )
  useActionFeedback(state)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Pencil className="h-3.5 w-3.5 mr-1" /> Bearbeiten
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kampagne bearbeiten</DialogTitle>
          <DialogDescription>
            Aktualisiere Budget, Zeitraum oder Aktiv-Status.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={campaign.id} />
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input name="name" defaultValue={campaign.name} />
          </div>
          <div className="space-y-1.5">
            <Label>Quelle</Label>
            <Select name="source" defaultValue={campaign.source ?? ''}>
              <SelectTrigger>
                <SelectValue placeholder="Quelle wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Keine Quelle</SelectItem>
                {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <input
              type="checkbox"
              name="is_active"
              value="on"
              defaultChecked={campaign.is_active}
              className="mt-0.5"
            />
            <div>
              <div className="font-medium text-slate-800">Kampagne aktiv</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Inaktive Kampagnen sind bei Imports/Zuweisungen ausgeblendet.
              </div>
            </div>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-3">
              <Label>Budget (€)</Label>
              <Input
                name="budget_amount"
                type="number"
                defaultValue={campaign.budget_amount ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Startdatum</Label>
              <Input name="start_date" type="date" defaultValue={campaign.start_date ?? ''} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Enddatum</Label>
              <Input name="end_date" type="date" defaultValue={campaign.end_date ?? ''} />
            </div>
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {typeof state.error === 'string' ? state.error : 'Fehler'}
            </div>
          )}
          <DialogFooter>
            <SubmitButton size="sm">
              <Pencil className="h-4 w-4 mr-1.5" /> Änderungen speichern
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
