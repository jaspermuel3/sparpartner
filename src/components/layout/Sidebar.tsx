'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard,
  UserPlus,
  Users,
  CreditCard,
  PhoneForwarded,
  BarChart3,
  Settings,
  Layers,
  ShieldCheck,
  Coins,
  Menu,
  PanelLeft,
  PanelLeftClose,
  Globe2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'
import { UserMenu } from './UserMenu'
import { NotificationCenter } from '@/components/ui-custom/NotificationCenter'
import { GlobalNotifiers } from '@/components/ui-custom/GlobalNotifiers'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const SALES_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/request-lead', label: 'Lead anfordern', icon: UserPlus },
  { href: '/my-leads', label: 'Meine Leads', icon: Layers },
  { href: '/callbacks', label: 'Rückrufe', icon: PhoneForwarded },
  { href: '/token-history', label: 'Token-Historie', icon: CreditCard },
  { href: '/stats', label: 'Statistiken', icon: BarChart3 },
  { href: '/settings', label: 'Einstellungen', icon: Settings },
]

const ADMIN_NAV: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/leads', label: 'Leads', icon: Layers },
  { href: '/admin/landing-leads', label: 'Landing Leads', icon: Globe2 },
  { href: '/admin/sellers', label: 'Benutzer', icon: Users },
  { href: '/admin/tokens', label: 'Tokens', icon: CreditCard },
  { href: '/admin/stats', label: 'Statistiken', icon: BarChart3 },
  { href: '/admin/audit-log', label: 'Audit-Log', icon: ShieldCheck },
  { href: '/admin/settings', label: 'Einstellungen', icon: Settings },
]

export function Sidebar({
  role,
  walletBalance,
  fullName,
  email,
  children,
}: {
  role: UserRole
  walletBalance?: number | null
  fullName?: string | null
  email?: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const nav = role === 'admin' ? ADMIN_NAV : SALES_NAV
  const basePath = role === 'admin' ? '/admin' : ''

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem('crm:sidebar-collapsed') === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      document.documentElement.style.setProperty('--sidebar-w', collapsed ? '4rem' : '16rem')
      window.localStorage.setItem('crm:sidebar-collapsed', collapsed ? '1' : '0')
    } catch {
      /* noop */
    }
  }, [collapsed])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        <DesktopNav
          nav={nav}
          pathname={pathname}
          role={role}
          walletBalance={walletBalance}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
        />
        <div
          className={cn(
            'flex min-h-screen w-full flex-col transition-[padding] duration-300',
            collapsed ? 'lg:pl-16' : 'lg:pl-64',
          )}
        >
          <MobileHeader nav={nav} fullName={fullName} email={email} role={role} walletBalance={walletBalance} />
          <div key={pathname} className="page-transition-in flex-1 w-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function DesktopNav({
  nav,
  pathname,
  role,
  walletBalance,
  collapsed,
  onToggleCollapsed,
}: {
  nav: NavItem[]
  pathname: string
  role: UserRole
  walletBalance?: number | null
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 z-30 hidden flex-col border-r border-slate-200 bg-white transition-[width] duration-300 ease-out lg:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex h-16 items-center border-b border-slate-200',
          collapsed ? 'justify-center px-1' : 'gap-3 px-5',
        )}
      >
        <Image
          src="/sparpartner-logo.svg"
          alt="Sparpartner24 Logo"
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 drop-shadow-sm"
        />
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Sparpartner CRM</div>
            <div className="text-xs text-slate-500">{role === 'admin' ? 'Admin-Bereich' : 'Verkäufer'}</div>
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={collapsed ? 'Seitenleiste aufklappen' : 'Seitenleiste einklappen'}
              onClick={onToggleCollapsed}
              className={cn(
                'hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 lg:inline-flex',
                collapsed ? 'absolute left-4 top-16 -translate-y-1/2 h-8 w-8 bg-white shadow-md' : 'ml-auto h-8 w-8',
              )}
            >
              {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{collapsed ? 'Aufklappen' : 'Einklappen'}</TooltipContent>
        </Tooltip>
      </div>

      {role === 'seller' && typeof walletBalance === 'number' && !collapsed && (
        <div className="mx-3 mt-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Coins className="h-3.5 w-3.5 text-amber-500" />
            Token-Guthaben
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-semibold tracking-tight text-slate-900">{walletBalance}</span>
            <span className="text-xs text-slate-500">Tokens</span>
          </div>
          <Link
            href="/request-lead"
            className="mt-3 flex items-center justify-center rounded-lg bg-slate-900 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            Lead anfordern
          </Link>
        </div>
      )}

      {role === 'seller' && typeof walletBalance === 'number' && collapsed && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="mx-auto mt-3 flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700">
              <Coins className="h-4 w-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            {walletBalance} Tokens · <Link href="/request-lead">Anfordern</Link>
          </TooltipContent>
        </Tooltip>
      )}

      <nav className="flex-1 space-y-1 px-3 py-5">
        {nav.map((item) => {
          const Icon = item.icon
          const active =
            pathname === item.href ||
            (item.href !== (role === 'admin' ? '/admin/dashboard' : '/dashboard') &&
              pathname.startsWith(item.href))
          const body = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors duration-200',
                collapsed ? 'justify-center px-1.5 h-11' : 'px-3',
                active
                  ? 'bg-slate-900 text-white shadow-sm sidebar-link-active'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
              aria-label={collapsed ? item.label : undefined}
            >
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0 transition-transform duration-200',
                  active ? 'text-white scale-105' : 'text-slate-400 group-hover:text-slate-600 group-hover:scale-105',
                )}
              />
              {!collapsed && (
                <span className={cn(
                  'transition-all duration-200',
                  active ? 'translate-x-0.5' : '',
                )}>
                  {item.label}
                </span>
              )}
            </Link>
          )
          if (!collapsed) return body
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{body}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
    </aside>
  )
}

function MobileHeader({
  nav,
  fullName,
  email,
  role,
  walletBalance,
}: {
  nav: NavItem[]
  fullName?: string | null
  email?: string | null
  role: UserRole
  walletBalance?: number | null
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:px-8">
        <div className="flex items-center gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" variant="ghost" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex flex-col h-full">
                <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
                  <Image
                    src="/sparpartner-logo.svg"
                    alt="Sparpartner24 Logo"
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 drop-shadow-sm"
                  />
                  <div className="leading-tight">
                    <div className="text-sm font-semibold tracking-tight">Sparpartner CRM</div>
                    <div className="text-xs text-slate-500">{role === 'admin' ? 'Admin' : 'Verkäufer'}</div>
                  </div>
                </div>
                <nav className="flex-1 space-y-1 px-3 py-5 overflow-auto">
                  {nav.map((item) => {
                    const Icon = item.icon
                    const active = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    )
                  })}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
          <div className="font-semibold tracking-tight lg:hidden">Sparpartner CRM</div>
        </div>

        <div className="flex items-center gap-3">
          {role === 'seller' && typeof walletBalance === 'number' && (
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm sm:flex">
              <Coins className="h-3.5 w-3.5 text-amber-500" />
              {walletBalance} Tokens
            </div>
          )}
          <NotificationCenter />
          <UserMenu role={role}>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-[11px] font-semibold text-white">
                {(fullName ?? email ?? '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="hidden leading-tight sm:block pr-2">
                <div className="text-xs font-medium text-slate-900">{fullName ?? 'Benutzer'}</div>
                <div className="text-[11px] text-slate-500">{email}</div>
              </div>
            </div>
          </UserMenu>
        </div>
      </header>
      <GlobalNotifiers />
    </>
  )
}
