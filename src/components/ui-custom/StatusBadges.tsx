'use client'

import { Badge } from '@/components/ui/badge'
import type { LeadStatus, CallbackStatus, ContactResult } from '@/types'
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_CLASSES,
  CALLBACK_STATUS_LABELS,
  CONTACT_RESULT_LABELS,
  CONTACT_RESULT_COLORS,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

export function LeadStatusBadge({ status, showPop }: { status: LeadStatus; showPop?: boolean }) {
  const label = LEAD_STATUS_LABELS[status] ?? status
  const cls = LEAD_STATUS_CLASSES[status] ?? ''
  const [popKey, setPopKey] = useState(0)

  useEffect(() => {
    setPopKey((k) => k + 1)
  }, [status])

  return (
    <span
      key={`${status}-${popKey}`}
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-[transform,opacity] duration-200',
        cls,
        showPop !== false && 'status-pop',
      )}
    >
      {label}
    </span>
  )
}

export function CallbackStatusBadge({ status }: { status: CallbackStatus }) {
  const label = CALLBACK_STATUS_LABELS[status]
  const cls =
    status === 'offen'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : status === 'erledigt'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-slate-100 text-slate-500 border-slate-200'
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium', cls)}>
      {label}
    </span>
  )
}

export function ContactResultPill({ result }: { result: ContactResult }) {
  const label = CONTACT_RESULT_LABELS[result]
  const cls = CONTACT_RESULT_COLORS[result]
  return (
    <span className={cn('inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium', cls)}>
      {label}
    </span>
  )
}
