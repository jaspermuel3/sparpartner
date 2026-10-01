'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export interface ActionResult {
  ok?: boolean
  error?: string
  redirectTo?: string
  toast?: { title: string; description?: string; variant?: 'default' | 'success' | 'error' }
  [key: string]: unknown
}

let savePillMounted = false

function ensureSavePillRoot(): HTMLDivElement {
  let root = document.getElementById('crm-save-pill-root') as HTMLDivElement | null
  if (!root) {
    root = document.createElement('div')
    root.id = 'crm-save-pill-root'
    root.className =
      'pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2'
    document.body.appendChild(root)
  }
  return root
}

export function showSaveIndicator(label = 'Gespeichert') {
  if (typeof document === 'undefined') return
  const root = ensureSavePillRoot()
  const pill = document.createElement('div')
  pill.className =
    'save-pill pointer-events-none inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/95 backdrop-blur px-3.5 py-1.5 text-xs font-medium text-emerald-700 shadow-lg shadow-emerald-900/10'
  pill.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg><span>${label.replace(/"/g, '&quot;')}</span>`
  root.appendChild(pill)
  setTimeout(() => {
    pill.remove()
  }, 1700)
}

export function useActionFeedback(result: ActionResult | null, opts?: { saveLabel?: string; quiet?: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (!result) return
    const errorMsg =
      typeof result.error === 'string'
        ? result.error
        : result.error
          ? 'Es ist ein Fehler aufgetreten.'
          : undefined
    const toastDesc =
      typeof result.toast?.description === 'string' ? result.toast.description : undefined
    if (errorMsg) {
      toast.error(result.toast?.title ?? 'Fehler', {
        description: toastDesc ?? errorMsg,
      })
    } else {
      if (result.toast) {
        const v = result.toast.variant
        const title = typeof result.toast.title === 'string' ? result.toast.title : 'Erfolgreich'
        if (v === 'error') {
          toast.error(title, { description: toastDesc })
        } else if (v === 'success' || !v) {
          toast.success(title, { description: toastDesc })
        } else {
          toast(title, { description: toastDesc })
        }
      } else if (result.ok) {
        if (!opts?.quiet) toast.success('Erfolgreich gespeichert')
        showSaveIndicator(opts?.saveLabel ?? 'Gespeichert')
      } else if (!opts?.quiet && result.ok !== false) {
        showSaveIndicator(opts?.saveLabel ?? 'Gespeichert')
      }
      if (result.redirectTo && typeof result.redirectTo === 'string') {
        router.push(result.redirectTo)
      }
    }
  }, [result, router, opts?.quiet, opts?.saveLabel])
}

export function SubmitButton({
  children,
  variant = 'default',
  size = 'default',
  className,
  disabled,
  pendingLabel = 'Speichern…',
}: {
  children: React.ReactNode
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  disabled?: boolean
  pendingLabel?: string
}) {
  const { pending } = useFormStatus()
  const btnCls: Record<string, string> = {
    default: 'bg-slate-900 text-white hover:bg-slate-800',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    ghost: 'text-slate-700 hover:bg-slate-100',
    link: 'text-slate-900 underline-offset-4 hover:underline',
  }
  const sizeCls: Record<string, string> = {
    default: 'h-9 px-4 py-2 text-sm',
    sm: 'h-8 rounded-md px-3 text-xs',
    lg: 'h-10 rounded-lg px-6 text-base',
    icon: 'h-9 w-9',
  }
  const isDisabled = Boolean(pending || disabled)
  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ' +
        btnCls[variant] + ' ' + sizeCls[size] + ' ' + (className ?? '')
      }
    >
      {pending ? pendingLabel : children}
    </button>
  )
}
