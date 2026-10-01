'use client'

import { ChevronDown } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function useCollapsed(key: string, defaultOpen: boolean) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return !defaultOpen
    try {
      const v = window.localStorage.getItem(`card:collapsed:${key}`)
      if (v === '1') return true
      if (v === '0') return false
    } catch {
      /* noop */
    }
    return !defaultOpen
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(`card:collapsed:${key}`, collapsed ? '1' : '0')
    } catch {
      /* noop */
    }
  }, [collapsed, key])

  return [collapsed, setCollapsed] as const
}

export function CollapsibleCard({
  id,
  title,
  subtitle,
  icon,
  actions,
  children,
  defaultOpen = true,
  className,
}: {
  id: string
  title: ReactNode
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  const [collapsed, setCollapsed] = useCollapsed(id, defaultOpen)

  return (
    <Card className={cn('card-hoverable border border-slate-200 bg-white shadow-sm', className)}>
      <CardHeader className="cursor-pointer select-none px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex min-h-[44px] flex-1 items-center gap-2 text-left"
            aria-expanded={!collapsed}
            aria-controls={`${id}-body`}
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
              {icon ?? <span className="h-2 w-2 rounded-full bg-slate-400" />}
            </span>
            <div className="flex flex-col items-start text-left">
              <CardTitle className="text-sm font-semibold text-slate-800">{title}</CardTitle>
              {subtitle ? (
                <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
              ) : null}
            </div>
          </button>
          <div className="flex items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Aufklappen' : 'Zuklappen'}
              className="inline-flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', collapsed ? '-rotate-90' : 'rotate-0')}
              />
            </button>
          </div>
        </div>
      </CardHeader>
      <div
        id={`${id}-body`}
        role="region"
        className={cn(
          'grid transition-all duration-300 ease-out',
          collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
        )}
      >
        <div className="overflow-hidden">
          <CardContent className="px-5 py-4 pt-0">{children}</CardContent>
        </div>
      </div>
    </Card>
  )
}
