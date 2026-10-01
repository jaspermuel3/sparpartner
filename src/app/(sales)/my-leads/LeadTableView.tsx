'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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
  Check,
  X,
  Pencil,
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
import { useFormState } from 'react-dom'
import { updateLeadInlineAction } from '@/app/actions'
import { useActionFeedback } from '@/components/ui-custom/FormHelpers'

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
              <TableRow className="stagger-item" style={{ animationDelay: '80ms' }}>
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
            {data.map((lead, idx) => {
              const leadAny = lead as any
              const ageDays = formatDaysSince(leadAny.assigned_at ?? lead.created_at)
              const isDup = duplicates.has(lead.id)
              const staggerDelay = Math.min(600, 60 + idx * 45)
              return (
                <TableRow
                  key={lead.id}
                  className="group relative crm-row-hover stagger-item"
                  style={{ animationDelay: `${staggerDelay}ms` }}
                >
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
                      <div className="block min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <InlineEditCell
                            leadId={lead.id}
                            field="name"
                            value={`${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim()}
                            splitFields={['first_name', 'last_name']}
                            trigger={
                              <div className="font-medium text-slate-900 group-hover:text-slate-950 truncate cursor-text">
                                {lead.first_name} {lead.last_name}
                              </div>
                            }
                          />
                          {isDup ? (
                            <span className="inline-flex items-center gap-0.5 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              <AlertCircle className="h-2.5 w-2.5" />
                              Dublette
                            </span>
                          ) : null}
                        </div>
                        {lead.email ? (
                          <div className="mt-0.5 max-w-[280px]">
                            <InlineEditCell
                              leadId={lead.id}
                              field="email"
                              value={lead.email ?? ''}
                              inputType="email"
                              trigger={
                                <div className="truncate text-xs text-slate-500 cursor-text">{lead.email}</div>
                              }
                            />
                          </div>
                        ) : null}
                        {lead.phone ? (
                          <div className="mt-0.5">
                            <InlineEditCell
                              leadId={lead.id}
                              field="phone"
                              value={lead.phone ?? ''}
                              inputType="tel"
                              renderValue={(v) => formatPhone(v)}
                              trigger={
                                <div className="text-xs text-slate-500 tabular-nums cursor-text">{formatPhone(lead.phone)}</div>
                              }
                            />
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                  )}
                  {colVisible('product') && (
                    <TableCell className="hidden md:table-cell py-3 align-top text-sm text-slate-600">
                      {PRODUCT_LABELS[lead.product as ProductType] ?? '—'}
                    </TableCell>
                  )}
                  {colVisible('status') && (
                    <TableCell className="py-3 align-top">
                      <LeadStatusBadge status={lead.status as LeadStatus} showPop={false} />
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

type InlineField = 'name' | 'first_name' | 'last_name' | 'phone' | 'email'

function InlineEditCell({
  leadId,
  field,
  value,
  trigger,
  splitFields,
  inputType = 'text',
  renderValue,
}: {
  leadId: string
  field: InlineField
  value: string
  trigger: React.ReactNode
  splitFields?: [string, string]
  inputType?: 'text' | 'email' | 'tel'
  renderValue?: (v: string) => string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [validState, setValidState] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const [state, formAction] = useFormState(async (_prev: any, fd: FormData) => {
    const res = (await updateLeadInlineAction(fd)) as any
    return res
  }, null)
  useActionFeedback(state, { quiet: true })

  useEffect(() => {
    if (editing) {
      setDraft(value)
      setValidState('idle')
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [editing, value])

  useEffect(() => {
    if (!editing) return
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setEditing(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setEditing(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKey)
    }
  }, [editing])

  function validate(v: string): boolean {
    if (inputType === 'email') {
      const ok = v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
      setValidState(v === '' ? 'idle' : ok ? 'valid' : 'invalid')
      return ok
    }
    if (inputType === 'tel') {
      const digits = v.replace(/\D/g, '').length
      const ok = v === '' || digits >= 6
      setValidState(v === '' ? 'idle' : ok ? 'valid' : 'invalid')
      return ok
    }
    if (field === 'name' || field === 'first_name' || field === 'last_name') {
      const trimmed = v.trim()
      if (splitFields) {
        const parts = trimmed.split(/\s+/).filter(Boolean)
        const ok = parts.length >= 1
        setValidState(trimmed === '' ? 'idle' : ok ? 'valid' : 'invalid')
        return ok
      }
      const ok = trimmed.length > 0
      setValidState(trimmed === '' ? 'idle' : ok ? 'valid' : 'invalid')
      return ok
    }
    setValidState('idle')
    return true
  }

  function handleSave() {
    if (!validate(draft)) return
    const fd = new FormData()
    fd.append('leadId', leadId)
    if (splitFields) {
      const parts = draft.trim().split(/\s+/)
      const f = parts[0] ?? ''
      const l = parts.slice(1).join(' ')
      // Zweistufig: two individual calls
      const fd1 = new FormData()
      fd1.append('leadId', leadId)
      fd1.append('field', splitFields[0])
      fd1.append('value', f)
      updateLeadInlineAction(fd1)
        .then(() => {
          const fd2 = new FormData()
          fd2.append('leadId', leadId)
          fd2.append('field', splitFields[1])
          fd2.append('value', l)
          return updateLeadInlineAction(fd2)
        })
        .then(() => {
          setValidState('valid')
          setTimeout(() => setEditing(false), 180)
        })
    } else {
      fd.append('field', field)
      fd.append('value', draft)
      formAction(fd)
      setValidState('valid')
      setTimeout(() => setEditing(false), 180)
    }
  }

  if (!editing) {
    return (
      <div
        onDoubleClick={() => setEditing(true)}
        className="group/inline-edit"
        title="Doppelklick zum Bearbeiten"
      >
        <div className="flex items-center gap-1">
          {trigger}
          <button
            type="button"
            aria-label="Bearbeiten"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setEditing(true)
            }}
            className="opacity-0 group-hover/inline-edit:opacity-100 transition-opacity inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-slate-400 hover:border-slate-200 hover:bg-white hover:text-slate-700"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-[320px] fade-slide-up">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }}
        className="flex items-center gap-1"
      >
        <input
          ref={inputRef}
          type={inputType}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            validate(e.target.value)
          }}
          className={cn(
            'w-full h-8 rounded-md border px-2 text-xs outline-none transition-all',
            'bg-white text-slate-900 shadow-sm',
            validState === 'valid' && 'field-valid',
            validState === 'invalid' && 'field-invalid',
            validState === 'idle' && 'border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-950/10',
          )}
          placeholder={inputType === 'email' ? 'name@domain.de' : inputType === 'tel' ? '+49 ...' : 'Wert eingeben…'}
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="submit"
          aria-label="Speichern"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Abbrechen"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          onClick={(e) => {
            e.stopPropagation()
            setEditing(false)
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </form>
      {renderValue ? null : inputType === 'email' && validState === 'invalid' ? (
        <div className="mt-0.5 text-[10px] text-red-600">Ungültige E-Mail-Adresse</div>
      ) : inputType === 'tel' && validState === 'invalid' ? (
        <div className="mt-0.5 text-[10px] text-red-600">Mind. 6 Ziffern erforderlich</div>
      ) : null}
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
