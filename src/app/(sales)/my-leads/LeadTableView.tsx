'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  ChevronLeft,
  ChevronRight,
  Settings2,
  Phone,
  Mail,
  ArrowUpRight,
  AlertCircle,
  Layers,
} from 'lucide-react'
import { LeadAvatar } from '@/components/ui-custom/LeadAvatar'
import { LeadStatusBadge } from '@/components/ui-custom/StatusBadges'
import {
  LEAD_STATUS_LABELS,
  PRODUCT_LABELS,
  formatDate,
  formatPhone,
  formatDaysSince,
  leadAgeClass,
  phoneHref,
} from '@/lib/constants'
import { buildQueryString, cn } from '@/lib/utils'
import type { Lead, LeadStatus, ProductType } from '@/types'
import { Suspense } from 'react'
import { SkeletonShimmer } from '@/components/ui-custom/SkeletonShimmer'
import { useRouter } from 'next/navigation'

type LeadLike = Lead & { email?: string | null; phone?: string | null }

type SearchParamsLike = Record<string, string | undefined>

const STORAGE_KEY_COLUMNS = 'crm:my-leads:columns:v1'
const STORAGE_KEY_PAGESIZE = 'crm:my-leads:pagesize:v1'

const ALL_COLUMNS: Array<{ id: string; label: string; defaultVisible: boolean; minWidth?: string }> = [
  { id: 'name', label: 'Name / Kontakt', defaultVisible: true },
  { id: 'product', label: 'Produkt', defaultVisible: true },
  { id: 'status', label: 'Status', defaultVisible: true },
  { id: 'age', label: 'Alter', defaultVisible: true },
  { id: 'assigned', label: 'Zugewiesen am', defaultVisible: true },
  { id: 'contact', label: 'Letzter Kontakt', defaultVisible: false },
]

const PAGE_SIZES = [10, 25, 50, 100]

export function LeadTableView({
  data,
  count,
  page,
  pageSize: initialPageSize,
  searchParams,
}: {
  data: LeadLike[]
  count: number
  page: number
  pageSize: number
  searchParams: SearchParamsLike
}) {
  const router = useRouter()
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') {
      return Object.fromEntries(ALL_COLUMNS.map((c) => [c.id, c.defaultVisible]))
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_COLUMNS)
      if (raw) {
        const parsed = JSON.parse(raw)
        const base = Object.fromEntries(ALL_COLUMNS.map((c) => [c.id, c.defaultVisible]))
        return { ...base, ...parsed }
      }
    } catch {}
    return Object.fromEntries(ALL_COLUMNS.map((c) => [c.id, c.defaultVisible]))
  })

  const [pageSize, setPageSize] = useState<number>(() => {
    if (initialPageSize && PAGE_SIZES.includes(initialPageSize)) return initialPageSize
    if (typeof window === 'undefined') return 25
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_PAGESIZE)
      if (raw) {
        const n = Number(raw)
        if (PAGE_SIZES.includes(n)) return n
      }
    } catch {}
    return 25
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(visibleCols))
    } catch {}
  }, [visibleCols])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_PAGESIZE, String(pageSize))
    } catch {}
  }, [pageSize])

  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const effectivePage = Math.min(page, totalPages)

  // Einfache lokale Duplikat-Erkennung: gleiche Telefonnummer oder gleiche E-Mail
  const duplicates = useMemo(() => {
    const byPhone = new Map<string, string[]>()
    const byEmail = new Map<string, string[]>()
    for (const l of data) {
      if (l.phone) {
        const norm = l.phone.replace(/\D/g, '')
        if (norm.length >= 6) {
          const arr = byPhone.get(norm) ?? []
          arr.push(l.id)
          byPhone.set(norm, arr)
        }
      }
      if (l.email) {
        const norm = l.email.trim().toLowerCase()
        if (norm) {
          const arr = byEmail.get(norm) ?? []
          arr.push(l.id)
          byEmail.set(norm, arr)
        }
      }
    }
    const dupIds = new Set<string>()
    for (const arr of byPhone.values()) if (arr.length > 1) arr.forEach((i) => dupIds.add(i))
    for (const arr of byEmail.values()) if (arr.length > 1) arr.forEach((i) => dupIds.add(i))
    return dupIds
  }, [data])

  const colVisible = (id: string) => visibleCols[id] !== false

  function goToPage(p: number) {
    const targetPage = Math.max(1, Math.min(totalPages, p))
    const qs = buildQueryString(searchParams, { page: targetPage === 1 ? undefined : String(targetPage), pageSize: String(pageSize) })
    router.push(`/my-leads${qs}`)
  }

  function onChangePageSize(value: string) {
    const n = Number(value)
    if (!PAGE_SIZES.includes(n)) return
    setPageSize(n)
    const qs = buildQueryString(searchParams, { page: undefined, pageSize: String(n) })
    router.push(`/my-leads${qs}`)
  }

  function toggleColumn(id: string) {
    setVisibleCols((prev) => ({ ...prev, [id]: !(prev[id] !== false) }))
  }

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 sm:px-5">
        <div className="text-xs text-slate-500 tabular-nums">
          {count} Eintrag{count === 1 ? '' : 'e'}
          {duplicates.size > 0 ? (
            <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
              <AlertCircle className="h-3 w-3" /> {duplicates.size} möglicher Duplikat{duplicates.size === 1 ? '' : 'e'}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Pro Seite:</span>
            <Select value={String(pageSize)} onValueChange={onChangePageSize}>
              <SelectTrigger className="h-8 w-[72px] border-slate-200 bg-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-slate-600 hover:text-slate-900">
                <Settings2 className="h-3.5 w-3.5" />
                Spalten
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel className="text-[11px] uppercase tracking-widest text-slate-400">Sichtbare Spalten</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_COLUMNS.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={colVisible(c.id)}
                  onCheckedChange={() => toggleColumn(c.id)}
                  className="text-xs"
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="crm-table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[48px] px-3 sm:px-4"></TableHead>
              {colVisible('name') && <TableHead>Name / Kontakt</TableHead>}
              {colVisible('product') && <TableHead className="hidden md:table-cell">Produkt</TableHead>}
              {colVisible('status') && <TableHead>Status</TableHead>}
              {colVisible('age') && <TableHead className="w-[96px]">Alter</TableHead>}
              {colVisible('assigned') && <TableHead className="hidden lg:table-cell">Zugewiesen am</TableHead>}
              {colVisible('contact') && <TableHead className="hidden xl:table-cell">Letzter Kontakt</TableHead>}
              <TableHead className="w-[36px] px-3 sm:px-4"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={ALL_COLUMNS.filter((c) => colVisible(c.id)).length + 2}>
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div className="text-sm font-medium text-slate-800">Keine passenden Leads</div>
                    <div className="mt-1 text-xs text-slate-500 max-w-xs">
                      Passe deine Filter an oder entferne die Suche.
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {data.map((lead) => {
              const leadAny = lead as any
              const ageDays = formatDaysSince(leadAny.assigned_at ?? lead.created_at)
              const isDup = duplicates.has(lead.id)
              return (
                <TableRow key={lead.id} className="group relative">
                  <TableCell className="px-3 sm:px-4 py-3 align-top">
                    <div className="relative">
                      <LeadAvatar firstName={lead.first_name} lastName={lead.last_name} size="md" className="h-9 w-9" />
                      {isDup ? (
                        <span
                          title="Mögliche Dublette"
                          className="absolute -right-1 -bottom-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white bg-amber-500 text-white shadow-sm"
                        >
                          <AlertCircle className="h-2.5 w-2.5" />
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  {colVisible('name') && (
                    <TableCell className="py-3 align-top">
                      <Link href={`/leads/${lead.id}`} className="block min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-slate-900 group-hover:text-slate-950 truncate">
                            {lead.first_name} {lead.last_name}
                          </div>
                          {isDup ? (
                            <span className="inline-flex items-center gap-0.5 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              <AlertCircle className="h-2.5 w-2.5" />
                              Dublette
                            </span>
                          ) : null}
                        </div>
                        {lead.email ? (
                          <div className="mt-0.5 truncate max-w-[280px] text-xs text-slate-500">{lead.email}</div>
                        ) : null}
                        {lead.phone ? (
                          <div className="mt-0.5 text-xs text-slate-500 tabular-nums">{formatPhone(lead.phone)}</div>
                        ) : null}
                      </Link>
                    </TableCell>
                  )}
                  {colVisible('product') && (
                    <TableCell className="hidden md:table-cell py-3 align-top text-sm text-slate-600">
                      {PRODUCT_LABELS[lead.product as ProductType] ?? '—'}
                    </TableCell>
                  )}
                  {colVisible('status') && (
                    <TableCell className="py-3 align-top">
                      <LeadStatusBadge status={lead.status as LeadStatus} />
                    </TableCell>
                  )}
                  {colVisible('age') && (
                    <TableCell className={`py-3 align-top text-xs font-medium tabular-nums ${leadAgeClass(ageDays)}`}>
                      {ageDays === null ? '—' : ageDays === 0 ? 'Heute' : `${ageDays} T.`}
                    </TableCell>
                  )}
                  {colVisible('assigned') && (
                    <TableCell className="hidden lg:table-cell py-3 align-top text-xs text-slate-500 tabular-nums">
                      {formatDate(leadAny.assigned_at ?? lead.created_at)}
                    </TableCell>
                  )}
                  {colVisible('contact') && (
                    <TableCell className="hidden xl:table-cell py-3 align-top text-xs text-slate-500 tabular-nums">
                      {leadAny.last_contact_at ? formatDate(leadAny.last_contact_at) : '—'}
                    </TableCell>
                  )}
                  <TableCell className="px-3 sm:px-4 py-3 align-top">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1">
                      {lead.phone ? (
                        <a
                          href={phoneHref(lead.phone)}
                          title="Anrufen"
                          aria-label="Anrufen"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                      {lead.email ? (
                        <a
                          href={`mailto:${lead.email}`}
                          title="E-Mail"
                          aria-label="E-Mail"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                      <Link
                        href={`/leads/${lead.id}`}
                        title="Öffnen"
                        aria-label="Lead öffnen"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-5">
          <div className="text-xs text-slate-500 tabular-nums">
            Seite {effectivePage} von {totalPages}
          </div>
          <div className="flex items-center gap-1">
            {effectivePage > 1 ? (
              <Button size="sm" variant="ghost" onClick={() => goToPage(effectivePage - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" variant="ghost" disabled>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="px-2 text-xs font-medium tabular-nums text-slate-600">
              {effectivePage} / {totalPages}
            </div>
            {effectivePage < totalPages ? (
              <Button size="sm" variant="ghost" onClick={() => goToPage(effectivePage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" variant="ghost" disabled>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function LeadTableSkeleton() {
  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 sm:px-5">
        <SkeletonShimmer className="h-3 w-28" />
        <div className="flex items-center gap-2">
          <SkeletonShimmer className="h-8 w-20" />
          <SkeletonShimmer className="h-8 w-20" />
        </div>
      </div>
      <div className="p-4 sm:p-5 space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonShimmer className="h-9 w-9 rounded-full" />
            <SkeletonShimmer className="h-9 w-52" />
            <SkeletonShimmer className="h-9 w-24 hidden md:block" />
            <SkeletonShimmer className="h-9 w-24" />
            <SkeletonShimmer className="h-9 w-16" />
            <SkeletonShimmer className="h-9 w-32 hidden lg:block" />
          </div>
        ))}
      </div>
    </div>
  )
}
