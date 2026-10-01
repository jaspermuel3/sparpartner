'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bell,
  CheckCheck,
  Coins,
  PhoneForwarded,
  UserPlus,
  AlertCircle,
  Info,
  ArrowRight,
  Layers,
  X,
  Loader2,
} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { formatDateShort, formatTime, TOKEN_TYPE_LABELS } from '@/lib/constants'
import {
  getUnreadCountAction,
  getNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/app/actions'
import type { Notification, NotificationType } from '@/types'
import { toast } from 'sonner'
import { useFormState } from 'react-dom'
import { useFormStatus } from 'react-dom'

const ICON_MAP: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  lead_assigned: UserPlus,
  lead_available: Layers,
  token_credit: Coins,
  token_low: AlertCircle,
  callback_due: PhoneForwarded,
  callback_overdue: PhoneForwarded,
  status_changed: Layers,
  contact_attempt: Layers,
  admin_alert: AlertCircle,
  info: Info,
}

const COLOR_MAP: Record<NotificationType, string> = {
  lead_assigned: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  lead_available: 'bg-blue-50 text-blue-600 border-blue-200',
  token_credit: 'bg-amber-50 text-amber-600 border-amber-200',
  token_low: 'bg-red-50 text-red-600 border-red-200',
  callback_due: 'bg-orange-50 text-orange-600 border-orange-200',
  callback_overdue: 'bg-red-50 text-red-600 border-red-200',
  status_changed: 'bg-violet-50 text-violet-600 border-violet-200',
  contact_attempt: 'bg-slate-50 text-slate-600 border-slate-200',
  admin_alert: 'bg-red-50 text-red-600 border-red-200',
  info: 'bg-slate-50 text-slate-600 border-slate-200',
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  async function refresh(forceItems = false) {
    try {
      setLoading((prev) => (forceItems ? true : prev))
      const needItems = forceItems || items.length === 0
      const [countRes, notifRes] = await Promise.all([
        getUnreadCountAction(),
        needItems ? getNotificationsAction(false, 30) : Promise.resolve({ ok: true, data: items }),
      ])
      if ('count' in countRes && countRes.ok) setUnread(countRes.count)
      if (needItems && 'ok' in notifRes && notifRes.ok && Array.isArray((notifRes as any).data)) {
        setItems((notifRes as any).data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh(true)
    const t = setInterval(() => refresh(false), 45_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (open) refresh(true)
  }, [open])

  async function handleClickNotif(n: Notification) {
    try {
      const fd = new FormData()
      fd.append('id', n.id)
      await markNotificationReadAction(fd)
      setUnread((u) => Math.max(0, u - 1))
      setItems((list) =>
        list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
      )
    } catch {}
    if (n.link) {
      setOpen(false)
      router.push(n.link)
    }
  }

  async function handleMarkAll() {
    try {
      const res = await markAllNotificationsReadAction() as any
      if (res?.error) toast.error(res.error)
      else {
        setUnread(0)
        setItems((list) => list.map((x) => ({ ...x, read_at: new Date().toISOString() })))
        toast.success('Alle als gelesen markiert')
      }
    } catch {}
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
          aria-label={`Benachrichtigungen (${unread} ungelesen)`}
        >
          <Bell className="h-4.5 w-4.5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] max-w-[92vw] p-0 shadow-xl" align="end">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-slate-500" />
            <div className="text-sm font-semibold text-slate-900">Benachrichtigungen</div>
            {unread > 0 && (
              <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                {unread} ungelesen
              </span>
            )}
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-md px-2 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Alle lesen
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-14 text-slate-400 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <div className="text-xs">Lade Benachrichtigungen…</div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400">
                <Bell className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium text-slate-800">Keine Benachrichtigungen</div>
              <div className="max-w-xs text-xs text-slate-500">
                Du wirst über neue Leads, Rückrufe und Guthaben informiert.
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((n) => {
                const Icon = ICON_MAP[n.type] ?? Info
                const unread = !n.read_at
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClickNotif(n)}
                      className={cn(
                        'group flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50',
                        unread && 'bg-slate-50/60',
                      )}
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                          COLOR_MAP[n.type],
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className={cn('text-[13px] font-semibold leading-tight', unread ? 'text-slate-900' : 'text-slate-700')}>
                            {n.title}
                          </div>
                          {unread && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                          )}
                        </div>
                        {n.body && (
                          <div className="mt-0.5 text-[12px] leading-snug text-slate-500 line-clamp-2">
                            {n.body}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                          <span>{formatDateShort(n.created_at)}</span>
                          <span>·</span>
                          <span>{formatTime(n.created_at)}</span>
                          {n.link && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-0.5 text-sky-600 group-hover:text-sky-700">
                                Öffnen
                                <ArrowRight className="h-3 w-3" />
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
          <div className="text-[10px] text-slate-400">Aktualisiert jede Minute</div>
          {items.length > 0 && (
            <Link
              href="/dashboard"
              className="inline-flex min-h-[32px] items-center rounded-md px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              Alle Aktivitäten →
            </Link>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
