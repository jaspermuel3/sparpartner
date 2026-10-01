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

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const label = LEAD_STATUS_LABELS[status] ?? status
  const cls = LEAD_STATUS_CLASSES[status] ?? ''
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
        cls,
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
