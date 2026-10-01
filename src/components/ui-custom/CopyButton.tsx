'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function CopyButton({
  text,
  label,
  className,
  size = 'md',
  ariaLabel,
  children,
}: {
  text: string | null | undefined
  label?: string
  className?: string
  size?: 'sm' | 'md'
  ariaLabel?: string
  children?: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!text) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
      setCopied(true)
      toast.success(`${label ?? 'Inhalt'} kopiert`, { description: text })
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Kopieren fehlgeschlagen')
    }
  }

  if (!text) return null

  const sizeClass =
    size === 'sm'
      ? 'h-8 min-h-[32px] px-2 text-xs gap-1'
      : 'h-8 w-8 min-h-[44px] min-w-[44px]'

  const hasChildren = children !== undefined && children !== null

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? `${label ?? 'Inhalt'} kopieren`}
      className={cn(
        'inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        sizeClass,
        className,
      )}
    >
      {hasChildren ? (
        copied ? (
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <Check className="h-3.5 w-3.5" />
            {children}
          </span>
        ) : (
          <span className="inline-flex items-center">{children}</span>
        )
      ) : copied ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  )
}
