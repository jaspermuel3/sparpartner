'use client'

import { createClient } from '@/lib/supabase/client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Coins, PhoneForwarded, UserPlus } from 'lucide-react'

type NotifyPrefs = {
  push_callbacks: boolean
  push_leads: boolean
  push_tokens: boolean
}

function loadPrefsFromAttr(): NotifyPrefs {
  if (typeof window === 'undefined')
    return { push_callbacks: true, push_leads: true, push_tokens: true }
  const el = document.getElementById('notify-prefs-json')
  if (!el) return { push_callbacks: true, push_leads: true, push_tokens: true }
  try {
    return JSON.parse(el.getAttribute('data-prefs') ?? '{}')
  } catch {
    return { push_callbacks: true, push_leads: true, push_tokens: true }
  }
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const disabled =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DISABLE_NOTIFICATIONS === '1'
  const channelRef = useRef<any>(null)
  const callbackTimersRef = useRef<Map<string, number>>(new Map())
  const [prefs, setPrefs] = useState<NotifyPrefs>(() => loadPrefsFromAttr())

  useEffect(() => {
    // Notify-Attr aktualisieren, wenn Einstellungen geladen werden
    if (typeof window === 'undefined') return
    const el = document.getElementById('notify-prefs-json')
    if (!el) return
    const obs = new MutationObserver(() => setPrefs(loadPrefsFromAttr()))
    obs.observe(el, { attributes: true })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (disabled) return
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return

    const requestPerm = async () => {
      if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission()
        } catch {
          /* noop */
        }
      }
    }
    requestPerm()

    let cancelled = false
    const start = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const channel = supabase.channel('crm:notifications', {
        config: { broadcast: { self: false } },
      })
      channelRef.current = channel

      channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'leads', filter: `assigned_user_id=eq.${user.id}` },
          (payload: any) => {
            if (!prefs.push_leads) return
            const newLead = payload?.new ?? {}
            toast('Neuer Lead zugewiesen', {
              description: `${newLead.first_name ?? ''} ${newLead.last_name ?? ''}`.trim() || 'Jetzt ansehen',
              icon: <UserPlus className="h-4 w-4 text-blue-600" />,
              action: {
                label: 'Öffnen',
                onClick: () => router.push(`/leads/${newLead.id}`),
              },
            })
            if (Notification.permission === 'granted') {
              try {
                new Notification('Neuer Lead zugewiesen', {
                  body: `${newLead.first_name ?? ''} ${newLead.last_name ?? ''}`.trim() || 'Jetzt ansehen',
                  tag: `lead-${newLead.id}`,
                })
              } catch {
                /* noop */
              }
            }
          },
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'token_transactions', filter: `user_id=eq.${user.id}` },
          (payload: any) => {
            if (!prefs.push_tokens) return
            const tx = payload?.new ?? {}
            if (!tx.amount) return
            const isCredit = tx.amount > 0
            if (!isCredit) return
            toast(`${tx.amount} Token gutgeschrieben`, {
              description: tx.reason || 'Dein Token-Guthaben wurde aktualisiert.',
              icon: <Coins className="h-4 w-4 text-amber-500" />,
            })
          },
        )
        .subscribe()

      // Rückruf-Erinnerungen anhand der vorhandenen Rückrufe planen
      try {
        const { data: callbacksRaw, error } = await supabase
          .from('callbacks')
          .select('id, callback_at, lead_id')
          .eq('user_id', user.id)
          .eq('status', 'offen')
          .gte('callback_at', new Date().toISOString())
        if (!error && Array.isArray(callbacksRaw)) {
          for (const cb of callbacksRaw as any[]) {
            const fireAt = new Date(cb.callback_at).getTime() - 5 * 60 * 1000
            const now = Date.now()
            if (fireAt > now && !callbackTimersRef.current.has(cb.id)) {
              const ms = fireAt - now
              const timer = window.setTimeout(() => {
                if (!prefs.push_callbacks) return
                toast('Rückruf in 5 Minuten', {
                  description: 'Öffne den Lead, um den Kunden anzurufen.',
                  icon: <PhoneForwarded className="h-4 w-4 text-orange-600" />,
                  action: {
                    label: 'Lead öffnen',
                    onClick: () => router.push(`/leads/${cb.lead_id}`),
                  },
                })
                callbackTimersRef.current.delete(cb.id)
              }, ms)
              callbackTimersRef.current.set(cb.id, timer)
            }
          }
        }
      } catch {
        /* noop */
      }
    }

    start()

    return () => {
      cancelled = true
      try {
        const supabase = createClient()
        if (channelRef.current) supabase.removeChannel(channelRef.current)
      } catch {
        /* noop */
      }
      for (const t of callbackTimersRef.current.values()) window.clearTimeout(t)
      callbackTimersRef.current.clear()
    }
  }, [disabled, router, pathname, prefs])

  return <>{children}</>
}
