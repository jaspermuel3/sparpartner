'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export interface ActionResult {
  ok?: boolean
  error?: string
  redirectTo?: string
  toast?: { title: string; description?: string; variant?: 'default' | 'success' | 'error' }
  [key: string]: unknown
}

export function useActionFeedback(result: ActionResult | null) {
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
        toast.success('Erfolgreich gespeichert')
      }
      if (result.redirectTo && typeof result.redirectTo === 'string') {
        router.push(result.redirectTo)
      }
    }
  }, [result, router])
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
