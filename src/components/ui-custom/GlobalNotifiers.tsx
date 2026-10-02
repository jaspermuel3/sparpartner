'use client'

import { useEffect, useRef } from 'react'
import {
  getDueCallbackRemindersAction,
  getAvailableLeadCountsAction,
  persistLeadAvailableNotificationAction,
  persistCallbackDueNotificationAction,
} from '@/app/actions'
import { toast } from 'sonner'
import Link from 'next/link'
import { Bell, PhoneForwarded, Layers } from 'lucide-react'
import { ProductType } from '@/types'
import { TOKEN_TYPE_LABELS } from '@/lib/constants'
import { useFormState } from 'react-dom'

const STORAGE_KEY = 'crm:notifications:last_prompt_dismissed'
const WAITLIST_STORAGE_KEY = 'crm:notifications:waitlist_last_notified'
const CALLBACK_STORAGE_KEY = 'crm:notifications:callback_last_notified'

function persistWaitlistRef(ref: React.MutableRefObject<Record<string, number>>) {
  try { sessionStorage.setItem(WAITLIST_STORAGE_KEY, JSON.stringify(ref.current)) } catch {}
  try { localStorage.setItem(WAITLIST_STORAGE_KEY, JSON.stringify(ref.current)) } catch {}
}
function persistCallbackRef(ref: React.MutableRefObject<Record<string, number>>) {
  try { sessionStorage.setItem(CALLBACK_STORAGE_KEY, JSON.stringify(ref.current)) } catch {}
  try { localStorage.setItem(CALLBACK_STORAGE_KEY, JSON.stringify(ref.current)) } catch {}
}

export function GlobalNotifiers() {
  const lastNotifiedWaitlistRef = useRef<Record<string, number>>({})
  const lastNotifiedCallbackRef = useRef<Record<string, number>>({})

  const [, persistWaitlistAction] = useFormState(persistLeadAvailableNotificationAction, null)
  const [, persistCallbackAction] = useFormState(persistCallbackDueNotificationAction, null)

  useEffect(() => {
    try {
      const cachedW =
        sessionStorage.getItem(WAITLIST_STORAGE_KEY) ??
        localStorage.getItem(WAITLIST_STORAGE_KEY)
      if (cachedW) lastNotifiedWaitlistRef.current = JSON.parse(cachedW)
      const cachedC =
        sessionStorage.getItem(CALLBACK_STORAGE_KEY) ??
        localStorage.getItem(CALLBACK_STORAGE_KEY)
      if (cachedC) lastNotifiedCallbackRef.current = JSON.parse(cachedC)
    } catch {}
  }, [])

  useEffect(() => {
    const persist = () => {
      persistWaitlistRef(lastNotifiedWaitlistRef)
      persistCallbackRef(lastNotifiedCallbackRef)
    }
    const id = window.setInterval(persist, 15_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const [countsRes, callbacksRes] = await Promise.all([
          getAvailableLeadCountsAction() as any,
          getDueCallbackRemindersAction() as any,
        ])

        if (!cancelled) {
          // ====== Punkt 13: Wartelisten-Benachrichtigung ======
          if (countsRes?.ok && countsRes.breakdown) {
            const counts = countsRes.breakdown as {
              total: number
              strom: number
              gas: number
              beides: number
            }
            const totalAvail = counts.total ?? 0
            const lastTs = lastNotifiedWaitlistRef.current['any:available'] ?? 0
            const debounce = 3 * 60 * 1000
            if (totalAvail > 0 && Date.now() - lastTs > debounce) {
              lastNotifiedWaitlistRef.current['any:available'] = Date.now()
              persistWaitlistRef(lastNotifiedWaitlistRef)
              const t = counts.beides ?? 0
              const s = counts.strom ?? 0
              const g = counts.gas ?? 0
              const unknown = Math.max(0, totalAvail - (t + s + g))
              const products: string[] = []
              if (t > 0) products.push(`${t}x Beides`)
              if (s > 0) products.push(`${s}x Strom`)
              if (g > 0) products.push(`${g}x Gas`)
              if (unknown > 0) products.push(`${unknown}x Sonstige`)

              const fdWaitlist = new FormData()
              fdWaitlist.append('product', totalAvail === t + s + g ? null as any : (products.join(', ') as any))
              fdWaitlist.append('count', String(totalAvail))
              try { persistWaitlistAction(fdWaitlist) } catch {}

              const id = toast.custom(
                (tID) => (
                  <div className="pointer-events-auto flex min-w-[320px] max-w-sm items-start gap-3 rounded-2xl border border-sky-200 bg-white shadow-2xl p-4 animate-in fade-in slide-in-from-right-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 border border-sky-200">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[13px] font-bold text-slate-900">Leads wieder verfügbar!</div>
                        <button
                          onClick={() => toast.dismiss(tID)}
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          aria-label="Schließen"
                        >
                          ×
                        </button>
                      </div>
                      <div className="mt-0.5 text-[12px] text-slate-600">
                        Es sind aktuell {products.join(', ')} im Pool.
                      </div>
                      <div className="mt-2">
                        <Link
                          href="/request-lead"
                          onClick={() => toast.dismiss(tID)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-sky-600 px-3 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-700 transition"
                        >
                          Jetzt anfordern
                        </Link>
                      </div>
                    </div>
                  </div>
                ),
                { duration: 12_000, position: 'top-right' },
              )
            }
          }

          // ====== Punkt 44: Rückruf-Erinnerung ======
          if (callbacksRes?.ok && Array.isArray(callbacksRes.data)) {
            const callbacks = callbacksRes.data as Array<{
              id: string
              lead_id: string
              callback_at: string
              lead?: { first_name?: string | null; last_name?: string | null; phone?: string | null }
            }>
            const debounce = 10 * 60 * 1000
            for (const cb of callbacks) {
              const lastTs = lastNotifiedCallbackRef.current[cb.id] ?? 0
              if (Date.now() - lastTs > debounce) {
                lastNotifiedCallbackRef.current[cb.id] = Date.now()
                persistCallbackRef(lastNotifiedCallbackRef)
                const cbDate = new Date(cb.callback_at)
                const overdue = cbDate.getTime() < Date.now() - 60_000
                const mins = Math.round(Math.max(0, Date.now() - cbDate.getTime()) / 60_000)
                const leadName = cb.lead
                  ? [cb.lead.first_name, cb.lead.last_name].filter(Boolean).join(' ') || 'Lead'
                  : 'Lead'
                const titleTxt = overdue ? `Rückruf überfällig: ${leadName}` : `Rückruf fällig: ${leadName}`
                const bodyTxt = overdue
                  ? `Seit ${mins} Min. überfällig. Sofort anrufen.`
                  : cbDate.toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })
                const cID = cb.id

                const fdCb = new FormData()
                fdCb.append('leadId', cb.lead_id)
                fdCb.append('leadName', leadName)
                fdCb.append('callbackAt', cb.callback_at)
                try { persistCallbackAction(fdCb) } catch {}

                toast.custom(
                  (tID) => (
                    <div className="pointer-events-auto flex min-w-[330px] max-w-sm items-start gap-3 rounded-2xl border border-orange-200 bg-white shadow-2xl p-4 animate-in fade-in slide-in-from-right-4">
                      <div
                        className={
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ' +
                          (overdue
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : 'bg-orange-100 text-orange-700 border-orange-200')
                        }
                      >
                        <PhoneForwarded className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[13px] font-bold text-slate-900">{titleTxt}</div>
                          <button
                            onClick={() => toast.dismiss(tID)}
                            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Schließen"
                          >
                            ×
                          </button>
                        </div>
                        <div className="mt-0.5 text-[12px] text-slate-600">{bodyTxt}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <Link
                            href={`/leads/${cb.lead_id}`}
                            onClick={() => toast.dismiss(tID)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-900 px-3 text-[11px] font-semibold text-white shadow-sm hover:bg-slate-800 transition"
                          >
                            <Bell className="h-3.5 w-3.5" />
                            Lead öffnen
                          </Link>
                          {cb.lead?.phone && (
                            <a
                              href={`tel:${cb.lead.phone}`}
                              onClick={() => toast.dismiss(tID)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                            >
                              <PhoneForwarded className="h-3.5 w-3.5" />
                              Anrufen
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ),
                  { duration: 18_000, position: 'top-right' },
                )
                // Nur den ersten fälligen pro Zyklus zeigen, damit der User nicht zugetoastet wird
                break
              }
            }
          }
        }
      } catch {
        // noop
      }
    }
    // Sofort starten, dann alle 90 Sekunden (guter Mittelweg)
    const immediate = window.setTimeout(run, 2_500)
    const interval = window.setInterval(run, 90_000)
    return () => {
      cancelled = true
      window.clearTimeout(immediate)
      window.clearInterval(interval)
    }
  }, [persistWaitlistAction, persistCallbackAction])

  return null
}
