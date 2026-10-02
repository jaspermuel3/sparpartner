'use client'

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LEAD_STATUS_LABELS, PRODUCT_LABELS, SOURCE_LABELS } from '@/lib/constants'
import type { LeadStatus, ProductType } from '@/types'

type Props = {
  statuses: readonly LeadStatus[]
  sellers: readonly { id: string; full_name?: string | null; email: string }[]
  products?: readonly ProductType[]
  sources?: readonly string[]
  initialStatus?: string
  initialAvailability?: string
  initialSeller?: string
  initialProduct?: string
  initialSource?: string
  initialHold?: string
}

export function AdminLeadFilterClient({
  statuses,
  sellers,
  products = ['strom', 'gas', 'beides'],
  sources = ['facebook', 'google', 'website', 'manual', 'import'],
  initialStatus = 'all',
  initialAvailability = 'all',
  initialSeller = 'all',
  initialProduct = 'all',
  initialSource = 'all',
  initialHold = '',
}: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [availability, setAvailability] = useState(initialAvailability)
  const [seller, setSeller] = useState(initialSeller)
  const [product, setProduct] = useState(initialProduct)
  const [source, setSource] = useState(initialSource)
  const [hold, setHold] = useState(initialHold)

  return (
    <>
      <div className="md:col-span-2">
        <label className="mb-1.5 block text-xs font-medium text-slate-600">Status</label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 w-full border-slate-200 bg-white text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {LEAD_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="status" value={status === 'all' ? '' : status} />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1.5 block text-xs font-medium text-slate-600">Verfügbarkeit</label>
        <Select value={availability} onValueChange={setAvailability}>
          <SelectTrigger className="h-10 w-full border-slate-200 bg-white text-sm">
            <SelectValue placeholder="Verfügbarkeit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Alle</SelectItem>
            <SelectItem value="available" className="text-xs">Nur verfügbar</SelectItem>
            <SelectItem value="assigned" className="text-xs">Nur zugewiesen</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="availability" value={availability === 'all' ? '' : availability} />
      </div>
      <div className="md:col-span-3">
        <label className="mb-1.5 block text-xs font-medium text-slate-600">Verkäufer</label>
        <Select value={seller} onValueChange={setSeller}>
          <SelectTrigger className="h-10 w-full border-slate-200 bg-white text-sm">
            <SelectValue placeholder="Verkäufer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Alle Verkäufer</SelectItem>
            {sellers.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
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
