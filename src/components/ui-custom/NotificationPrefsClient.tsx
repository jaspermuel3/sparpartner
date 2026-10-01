'use client'

import { useFormState } from 'react-dom'
import { saveNotifyPrefsAction } from '@/app/actions'
import { SubmitButton, useActionFeedback, type ActionResult } from '@/components/ui-custom/FormHelpers'
import { Label } from '@/components/ui/label'
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Bell, Mail, Smartphone } from 'lucide-react'

export function NotificationPrefsCard({
  initialPrefs,
}: {
  initialPrefs?: {
    push_callbacks?: boolean
    push_leads?: boolean
    push_tokens?: boolean
    email_summary?: boolean
    email_tokens?: boolean
  }
}) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await saveNotifyPrefsAction(fd)) as any,
    null,
  )
  useActionFeedback(state)

  return (
    <>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-400" />
          Benachrichtigungen
        </CardTitle>
        <div className="text-xs text-slate-500 pt-0.5">
          Wähle aus, wofür du benachrichtigt werden möchtest.
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <form action={formAction} className="space-y-3">
          <div className="space-y-2.5">
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                name="push_callbacks"
                defaultChecked={initialPrefs?.push_callbacks ?? false}
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Smartphone className="h-3.5 w-3.5 text-slate-400" />
                  Push bei Rückruf-Erinnerungen
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Benachrichtigung, wenn ein Rückruf-Termin erreicht ist.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                name="push_leads"
                defaultChecked={initialPrefs?.push_leads ?? false}
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Smartphone className="h-3.5 w-3.5 text-slate-400" />
                  Push bei neuem Lead
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Sofortige Push-Benachrichtigung bei neu zugewiesenem Lead.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                name="push_tokens"
                defaultChecked={initialPrefs?.push_tokens ?? false}
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Smartphone className="h-3.5 w-3.5 text-slate-400" />
                  Push bei Token-Buchungen
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Benachrichtigung, wenn Tokens aufgeladen oder abgezogen werden.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                name="email_summary"
                defaultChecked={initialPrefs?.email_summary ?? false}
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  Wöchentliche E-Mail Zusammenfassung
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Jeden Montag eine Übersicht deiner Performance per E-Mail.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                name="email_tokens"
                defaultChecked={initialPrefs?.email_tokens ?? false}
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  E-Mail bei Token-Transaktionen
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  E-Mail-Bestätigung bei jeder Token-Buchung und -Abbuchung.
                </div>
              </div>
            </label>
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <div className="pt-2 border-t border-slate-100">
            <SubmitButton size="sm">Einstellungen speichern</SubmitButton>
          </div>
        </form>
      </CardContent>
    </>
  )
}
