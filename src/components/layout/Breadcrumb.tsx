import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  if (!items || items.length === 0) return null
  return (
    <nav aria-label="Breadcrumb" className={cn('flex flex-wrap items-center gap-1 text-xs text-slate-500', className)}>
      {items.length === 1 && !items[0].href ? null : (
        <Link
          href="/dashboard"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-slate-400 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700"
          aria-label="Startseite"
        >
          <Home className="h-3.5 w-3.5" />
        </Link>
      )}
      {items.map((it, idx) => {
        const last = idx === items.length - 1
        const body = (
          <span
            className={cn(
              'max-w-[14rem] truncate rounded-md px-2 py-1 transition',
              last ? 'font-medium text-slate-800' : 'hover:bg-slate-50 hover:text-slate-700',
            )}
          >
            {it.label}
          </span>
        )
        return (
          <span key={`${it.label}-${idx}`} className="flex items-center">
            {idx === 0 && items.length > 1 ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
            ) : null}
            {!last && it.href ? (
              <Link href={it.href} className="hover:underline-offset-2 hover:underline">
                {body}
              </Link>
            ) : (
              body
            )}
            {!last ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden /> : null}
          </span>
        )
      })}
    </nav>
  )
}
