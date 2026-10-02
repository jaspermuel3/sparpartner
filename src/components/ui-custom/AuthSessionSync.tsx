'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { LogIn, Clock3 } from 'lucide-react'

export const RECENT_ACCOUNTS_KEY = 'crm:recent_accounts'
export const MAX_RECENT_ACCOUNTS = 5

export type RecentAccount = {
  email: string
  full_name: string | null
  role: 'admin' | 'seller'
  saved_at: number
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = name + '='
  const cookies = document.cookie.split(';')
  for (const raw of cookies) {
    const c = raw.trim()
    if (c.indexOf(prefix) === 0) {
      return c.substring(prefix.length)
    }
  }
  return null
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=;path=/;max-age=0;expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('de-DE', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function saveRecentAccount(account: Omit<RecentAccount, 'saved_at'>) {
  if (typeof window === 'undefined') return
  try {
    const existing = getRecentAccounts()
    const filtered = existing.filter((a) => a.email.toLowerCase() !== account.email.toLowerCase())
    const updated: RecentAccount[] = [
      { ...account, saved_at: Date.now() },
      ...filtered,
    ].slice(0, MAX_RECENT_ACCOUNTS)
    localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(updated))
  } catch {}
}

export function getRecentAccounts(): RecentAccount[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_ACCOUNTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as RecentAccount[]
  } catch {
    return []
  }
}

export function removeRecentAccount(email: string) {
  if (typeof window === 'undefined') return
  try {
    const existing = getRecentAccounts()
    const filtered = existing.filter((a) => a.email.toLowerCase() !== email.toLowerCase())
    localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(filtered))
  } catch {}
}

export function AuthSessionSync({
  email,
  fullName,
  role,
}: {
  email?: string | null
  fullName?: string | null
  role?: 'admin' | 'seller'
}) {
  const didShowRef = useRef(false)
  const didSaveRef = useRef(false)

  useEffect(() => {
    if (didShowRef.current) return
    const raw = readCookie('crm:last_login_context')
    if (!raw) return
    try {
      const decoded = decodeURIComponent(raw)
      const ctx = JSON.parse(decoded) as { at: string; email?: string | null; full_name?: string | null }
      if (ctx?.at) {
        toast.custom(
          (tID) => (
            <div className="pointer-events-auto flex min-w-[320px] max-w-sm items-start gap-3 rounded-2xl border border-emerald-200 bg-white shadow-2xl p-4 animate-in fade-in slide-in-from-right-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200">
                <Clock3 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-bold text-slate-900">Letzte Anmeldung</div>
                  <button
                    onClick={() => toast.dismiss(tID)}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Schließen"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-0.5 text-[12px] text-slate-600">
                  {formatDateTime(ctx.at)}
                </div>
              </div>
            </div>
          ),
          { duration: 9000, position: 'top-right' },
        )
        didShowRef.current = true
      }
    } catch {}
    deleteCookie('crm:last_login_context')
  }, [])

  useEffect(() => {
    if (didSaveRef.current) return
    if (!email) return
    saveRecentAccount({
      email,
      full_name: fullName ?? null,
      role: role ?? 'seller',
    })
    didSaveRef.current = true
  }, [email, fullName, role])

  return null
}
