'use client'

import { useState } from 'react'
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
  statuses: readonly LeadStatus[]
  sellers: readonly { id: string; full_name?: string | null; email: string }[]
  initialStatus?: string
  initialAvailability?: string
  initialSeller?: string
}

export function AdminLeadFilterClient({
  statuses,
  sellers,
  initialStatus = 'all',
  initialAvailability = 'all',
  initialSeller = 'all',
}: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [availability, setAvailability] = useState(initialAvailability)
  const [seller, setSeller] = useState(initialSeller)

  return (
    <>
      <div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="status" value={status === 'all' ? '' : status} />
      </div>
      <div>
        <Select value={availability} onValueChange={setAvailability}>
          <SelectTrigger>
            <SelectValue placeholder="Verfügbarkeit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="available">Nur verfügbar</SelectItem>
            <SelectItem value="assigned">Nur zugewiesen</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="availability" value={availability === 'all' ? '' : availability} />
      </div>
      <div className="md:col-span-3">
        <Select value={seller} onValueChange={setSeller}>
          <SelectTrigger>
            <SelectValue placeholder="Verkäufer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Verkäufer</SelectItem>
            {sellers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.full_name ?? s.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="seller" value={seller === 'all' ? '' : seller} />
      </div>
    </>
  )
}
