'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { LogOut, Settings, UserPlus, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getRecentAccounts, removeRecentAccount, type RecentAccount } from '@/components/ui-custom/AuthSessionSync'

const ROLE_LABEL: Record<'admin' | 'seller', string> = {
  admin: 'Admin',
  seller: 'Verkäufer',
}

function initialsOf(name: string | null, email: string | null): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/)
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return (email ?? '?').slice(0, 1).toUpperCase()
}

export function UserMenu({
  children,
  role,
  email,
  fullName,
}: {
  children: React.ReactNode
  role: 'admin' | 'seller'
  email?: string | null
  fullName?: string | null
}) {
  const settingsHref = role === 'admin' ? '/admin/settings' : '/settings'
  const [accounts, setAccounts] = useState<RecentAccount[]>([])

  useEffect(() => {
    const all = getRecentAccounts()
    const filtered = all.filter(
      (a) => !email || a.email.toLowerCase() !== email.toLowerCase(),
    )
    setAccounts(filtered)
  }, [email])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="outline-none">
          {children}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-1">
        <div className="flex items-start gap-3 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-semibold text-white">
            {initialsOf(fullName ?? null, email ?? null)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-900">
              {fullName || 'Benutzer'}
            </div>
            <div className="truncate text-[12px] text-slate-500">{email}</div>
            <div className="mt-0.5 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {ROLE_LABEL[role]}
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />

        <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Konto
        </div>
        <DropdownMenuItem asChild>
          <Link href={settingsHref} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4 text-slate-500" />
            Einstellungen
          </Link>
        </DropdownMenuItem>

        {accounts.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Anderes Konto verwenden
            </div>
            <div className="max-h-60 overflow-y-auto">
              {accounts.map((acc) => (
                <div
                  key={acc.email}
                  className="group/item relative"
                >
                  <form method="POST" action="/api/auth/logout" className="w-full">
                    <input
                      type="hidden"
                      name="next"
                      value={`/login?email=${encodeURIComponent(acc.email)}`}
                    />
                    <DropdownMenuItem asChild>
                      <button
                        type="submit"
                        className="flex w-full cursor-pointer items-center gap-3 pr-8"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                          {initialsOf(acc.full_name, acc.email)}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <div className="truncate text-[13px] font-medium text-slate-900">
                            {acc.full_name || acc.email}
                          </div>
                          <div className="truncate text-[11px] text-slate-500">
                            {acc.full_name ? acc.email : ROLE_LABEL[acc.role]}
                          </div>
                        </div>
                      </button>
                    </DropdownMenuItem>
                  </form>
                  <button
                    type="button"
                    onClick={() => {
                      removeRecentAccount(acc.email)
                      setAccounts((prev) => prev.filter((a) => a.email !== acc.email))
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:flex group-hover/item:flex"
                    aria-label={`${acc.email} aus Liste entfernen`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <DropdownMenuSeparator />

        <form method="POST" action="/api/auth/logout">
          <input
            type="hidden"
            name="next"
            value="/login"
          />
          <DropdownMenuItem asChild>
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center text-slate-700 focus:text-slate-900"
            >
              <UserPlus className="mr-2 h-4 w-4 text-slate-500" />
              Weiteres Konto hinzufügen
            </button>
          </DropdownMenuItem>
        </form>

        <form method="POST" action="/api/auth/logout">
          <input type="hidden" name="next" value="/login" />
          <DropdownMenuItem asChild>
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center text-red-600 focus:text-red-700 focus:bg-red-50"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Abmelden
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
