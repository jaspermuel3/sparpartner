'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LEAD_STATUS_LABELS } from '@/lib/constants'
import type { LeadStatus } from '@/types'

type Props = {
  defaultValue?: string
  statuses: readonly string[]
  allowAll?: boolean
  allLabel?: string
  paramName?: string
  name?: string
  className?: string
  placeholder?: string
  labels?: Record<string, string>
}

export function StatusFilterSelect({
  defaultValue = 'all',
  statuses,
  allowAll = true,
  allLabel = 'Alle Status',
  paramName,
  name,
  className,
  placeholder = 'Status',
  labels,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState<string>(defaultValue)
  const effectiveParamName = name ?? paramName ?? 'status'
  const labelMap = labels ?? LEAD_STATUS_LABELS

  const onValueChange = useCallback(
    (v: string) => {
      setValue(v)
      const next = new URLSearchParams(searchParams?.toString() ?? '')
      if (v === 'all' || !v) next.delete(effectiveParamName)
      else next.set(effectiveParamName, v)
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams, effectiveParamName],
  )

  const submitValue = (value === 'all' ? '' : value)

  return (
    <div className="flex items-center">
      <Select value={value} onValueChange={onValueChange} name={effectiveParamName}>
        <SelectTrigger className={className ?? 'w-[180px]'}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowAll && <SelectItem value="all">{allLabel}</SelectItem>}
          {statuses.map((s) => (
            <SelectItem key={s} value={s}>
              {(labelMap as Record<string, string>)[s] ?? s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={effectiveParamName} value={submitValue} />
    </div>
  )
}
