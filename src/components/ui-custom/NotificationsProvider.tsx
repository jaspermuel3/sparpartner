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

const DEDUP_STORAGE_KEY = 'crm:notif:dedup_seen_v1'
const DEDUP_TTL_MS = 5 * 60 * 1000

function loadDedupMap(): Map<string, number> {
  if (typeof window === 'undefined') return new Map()
  try {
    const raw = localStorage.getItem(DEDUP_STORAGE_KEY)
    if (!raw) return new Map()
    const obj = JSON.parse(raw) as Record<string, number>
    const now = Date.now()
    const m = new Map<string, number>()
    for (const [k, v] of Object.entries(obj)) {
      if (now - v < DEDUP_TTL_MS) m.set(k, v)
    }
    return m
  } catch {
    return new Map()
  }
}

function persistDedupMap(m: Map<string, number>) {
  if (typeof window === 'undefined') return
  try {
    const obj: Record<string, number> = {}
    const now = Date.now()
    for (const [k, v] of m.entries()) {
      if (now - v < DEDUP_TTL_MS) obj[k] = v
    }
    localStorage.setItem(DEDUP_STORAGE_KEY, JSON.stringify(obj))
  } catch {}
}

function isSeenAndMark(map: Map<string, number>, key: string): boolean {
  const now = Date.now()
  const last = map.get(key) ?? 0
  if (now - last < DEDUP_TTL_MS) return true
  map.set(key, now)
  persistDedupMap(map)
  return false
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const disabled =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DISABLE_NOTIFICATIONS === '1'
  const channelRef = useRef<any>(null)
  const callbackTimersRef = useRef<Map<string, number>>(new Map())
  const dedupSeenRef = useRef<Map<string, number>>(new Map())
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
    dedupSeenRef.current = loadDedupMap()
    const t = setInterval(() => {
      dedupSeenRef.current = loadDedupMap()
    }, 60_000)
    return () => clearInterval(t)
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
            const dedupKey = `lead_assigned:${newLead.id}`
            if (isSeenAndMark(dedupSeenRef.current, dedupKey)) return
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
            const dedupKey = `token_credit:${tx.id ?? `${tx.amount}:${tx.reason}:${tx.created_at}`}`
            if (isSeenAndMark(dedupSeenRef.current, dedupKey)) return
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
  }, [disabled, router, prefs])

  return <>{children}</>
}
