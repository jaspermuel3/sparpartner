'use client'

import Link from 'next/link'
import { LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function UserMenu({ children, role }: { children: React.ReactNode; role: 'admin' | 'seller' }) {
  const settingsHref = role === 'admin' ? '/admin/settings' : '/settings'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="outline-none">
          {children}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="px-2 py-1.5 text-xs text-slate-500">Konto</div>
        <DropdownMenuItem asChild>
          <Link href={settingsHref} className="cursor-pointer">Einstellungen</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form method="POST" action="/api/auth/logout">
          <DropdownMenuItem asChild>
            <button type="submit" className="flex w-full cursor-pointer items-center gap-2 text-red-600 focus:text-red-700 focus:bg-red-50">
              <LogOut className="h-4 w-4" />
              Abmelden
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
