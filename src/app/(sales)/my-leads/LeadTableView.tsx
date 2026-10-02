'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
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
  Zap,
  CalendarDays,
} from 'lucide-react'
import { LeadAvatar } from '@/components/ui-custom/LeadAvatar'
import { LeadStatusBadge } from '@/components/ui-custom/StatusBadges'
import {
  PRODUCT_LABELS,
  formatDate,
  formatDateShort,
  formatTime,
  formatRelative,
  formatPhone,
  formatDaysSince,
  leadAgeClass,
  phoneHref,
  LEAD_STATUS_CLASSES,
} from '@/lib/constants'
import { buildQueryString, cn } from '@/lib/utils'
import type { Lead, LeadStatus, ProductType } from '@/types'
import { SkeletonShimmer } from '@/components/ui-custom/SkeletonShimmer'
import { useRouter } from 'next/navigation'
import { useFormState } from 'react-dom'
import { updateLeadInlineAction } from '@/app/actions'
import { useActionFeedback } from '@/components/ui-custom/FormHelpers'

type LeadLike = Lead & { email?: string | null; phone?: string | null }

type SearchParamsLike = Record<string, string | undefined>

const STORAGE_KEY_PAGESIZE = 'crm:my-leads:pagesize:v1'

const PAGE_SIZES = [10, 25, 50, 100]

const STATUS_ACCENT: Record<LeadStatus, string> = {
  new: 'bg-slate-400',
  assigned: 'bg-blue-500',
  contacted: 'bg-amber-500',
  callback: 'bg-orange-500',
  offer: 'bg-indigo-500',
  closed: 'bg-emerald-500',
  no_interest: 'bg-red-500',
  wrong_data: 'bg-red-500',
  canceled: 'bg-slate-500',
  archived: 'bg-slate-400',
}

const STATUS_SOFT_BG: Record<LeadStatus, string> = {
  new: 'bg-slate-50',
  assigned: 'bg-blue-50/40',
  contacted: 'bg-amber-50/40',
  callback: 'bg-orange-50/40',
  offer: 'bg-indigo-50/40',
  closed: 'bg-emerald-50/40',
  no_interest: 'bg-red-50/30',
  wrong_data: 'bg-red-50/30',
  canceled: 'bg-slate-50',
  archived: 'bg-slate-50',
}

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
      window.localStorage.setItem(STORAGE_KEY_PAGESIZE, String(pageSize))
    } catch {}
  }, [pageSize])

  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const effectivePage = Math.min(page, totalPages)

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 sm:px-5 shadow-sm">
        <div className="text-xs text-slate-500 tabular-nums">
          <span className="font-medium text-slate-700">{count}</span> Eintrag{count === 1 ? '' : 'e'}
          {duplicates.size > 0 ? (
            <span className="ml-2.5 inline-flex items-center gap-1 text-amber-600">
              <AlertCircle className="h-3 w-3" /> {duplicates.size} möglicher Duplikat{duplicates.size === 1 ? '' : 'e'}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="hidden sm:inline">Pro Seite:</span>
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
        </div>
      </div>

      {data.length === 0 && (
        <div className="stagger-item" style={{ animationDelay: '80ms' }}>
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm">
              <Layers className="h-5 w-5" />
            </div>
            <div className="text-sm font-semibold text-slate-800">Keine passenden Leads</div>
            <div className="mt-1 text-xs text-slate-500 max-w-xs">
              Passe deine Filter an oder entferne die Suche.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.map((lead, idx) => {
          const leadAny = lead as any
          const sinceRaw = leadAny.assigned_at ?? lead.created_at
          const ageDays = formatDaysSince(sinceRaw)
          const relativeSince = formatRelative(sinceRaw)
          const exactTime = formatTime(sinceRaw)
          const exactDate = formatDateShort(sinceRaw)
          const lastContactRelative = formatRelative(leadAny.last_contact_at)
          const lastContactExact = formatTime(leadAny.last_contact_at)
          const isDup = duplicates.has(lead.id)
          const staggerDelay = Math.min(600, 40 + idx * 40)
          const statusKey = lead.status as LeadStatus
          const detailUrl = `/leads/${lead.id}`

          const lastContactDays = leadAny.last_contact_at ? formatDaysSince(leadAny.last_contact_at) : null
          const openCallbackOverdue = !!leadAny.next_callback_at && new Date(leadAny.next_callback_at).getTime() < Date.now() - 60_000
          const isUrgent =
            openCallbackOverdue ||
            (statusKey === 'new' && ageDays !== null && ageDays >= 2) ||
            (lastContactDays !== null && lastContactDays >= 10) ||
            (statusKey === 'callback' && openCallbackOverdue)

          return (
            <div
              key={lead.id}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button, a, [role=combobox], input, textarea, [data-no-nav]')) return
                router.push(detailUrl)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if ((e.target as HTMLElement).closest('button, a, input, textarea, [role=combobox]')) return
                  e.preventDefault()
                  router.push(detailUrl)
                }
              }}
              role="link"
              tabIndex={0}
              className={cn(
                'group stagger-item relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2',
                'transition-all duration-200 ease-out',
                'hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300',
                STATUS_SOFT_BG[statusKey] ?? 'bg-white',
                isUrgent && 'urgent-card-hover ring-1 ring-amber-300/40',
              )}
              style={{ animationDelay: `${staggerDelay}ms` }}
            >
              <div className={cn('absolute inset-y-0 left-0 w-1', STATUS_ACCENT[statusKey] ?? 'bg-slate-300')} />

              <div className="flex gap-3 p-3.5 sm:p-4 pl-4">
                <div className="relative shrink-0">
                  <Link href={detailUrl} tabIndex={-1} onClick={(e) => e.stopPropagation()} className="block" aria-hidden="true">
                    <LeadAvatar firstName={lead.first_name} lastName={lead.last_name} size="md" className="h-11 w-11 ring-2 ring-white shadow-sm" />
                  </Link>
                  {isDup ? (
                    <span
                      title="Mögliche Dublette"
                      className="absolute -right-0.5 -bottom-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-white shadow-sm"
                    >
                      <AlertCircle className="h-2.5 w-2.5" />
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <InlineEditCell
                          leadId={lead.id}
                          field="name"
                          value={`${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim()}
                          splitFields={['first_name', 'last_name']}
                          trigger={
                            <Link href={detailUrl} onClick={(e) => e.stopPropagation()} className="block truncate text-sm font-semibold text-slate-900 hover:underline decoration-slate-300 underline-offset-2">
                              {lead.first_name} {lead.last_name}
                            </Link>
                          }
                        />
                        {isDup ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700"
                            onClick={(e) => e.preventDefault()}
                          >
                            <AlertCircle className="h-2.5 w-2.5" />
                            Dublette
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <LeadStatusBadge status={statusKey} showPop={false} />
                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm">
                          <Zap className="h-2.5 w-2.5 text-slate-400" />
                          {PRODUCT_LABELS[lead.product as ProductType] ?? '—'}
                        </span>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'shrink-0 text-right w-[92px]',
                        ageDays !== null && leadAgeClass(ageDays),
                      )}
                    >
                      <div className="text-[10.5px] font-semibold tabular-nums leading-none">
                        {sinceRaw ? relativeSince : '—'}
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 text-[9.5px] text-slate-400 tabular-nums whitespace-nowrap">
                        <CalendarDays className="h-2.5 w-2.5" />
                        {exactDate} · {exactTime}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 space-y-1">
                    {lead.phone ? (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                        <InlineEditCell
                          leadId={lead.id}
                          field="phone"
                          value={lead.phone ?? ''}
                          inputType="tel"
                          renderValue={(v) => formatPhone(v)}
                          trigger={
                            <div className="truncate text-xs text-slate-600 tabular-nums cursor-pointer">
                              {formatPhone(lead.phone)}
                            </div>
                          }
                        />
                      </div>
                    ) : null}
                    {lead.email ? (
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                        <InlineEditCell
                          leadId={lead.id}
                          field="email"
                          value={lead.email ?? ''}
                          inputType="email"
                          trigger={
                            <div className="truncate text-xs text-slate-600 cursor-pointer">
                              {lead.email}
                            </div>
                          }
                        />
                      </div>
                    ) : null}
                    {leadAny.last_contact_at ? (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="h-3 w-3 shrink-0 rounded-full bg-emerald-400/60" />
                        <span className="text-[10.5px] text-slate-500 tabular-nums">
                          Letzter Kontakt: {lastContactRelative} · {lastContactExact}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  'flex items-center justify-between gap-2 border-t border-slate-100/80 bg-white/60 px-3.5 sm:px-4 pl-4 py-2',
                  'opacity-80 group-hover:opacity-100 transition-opacity',
                )}
              >
                <div className="flex items-center gap-1">
                  {lead.phone ? (
                    <button
                      type="button"
                      title="Anrufen"
                      aria-label="Anrufen"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        window.location.href = phoneHref(lead.phone)
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {lead.email ? (
                    <button
                      type="button"
                      title="E-Mail"
                      aria-label="E-Mail"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        window.location.href = `mailto:${lead.email}`
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mr-1">
                    Öffnen
                  </span>
                  <Link
                    href={detailUrl}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Lead öffnen"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-900 text-white shadow-sm hover:bg-slate-800 hover:scale-105 transition-all"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 sm:px-5 shadow-sm">
          <div className="text-xs text-slate-500 tabular-nums">
            Seite <span className="font-medium text-slate-700">{effectivePage}</span> von {totalPages}
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

const EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.de',
  'hotmail.com',
  'live.de',
  'web.de',
  'gmx.de',
  'gmx.net',
  'gmx.at',
  'icloud.com',
  'me.com',
  'yahoo.de',
  't-online.de',
  'aol.de',
  'freenet.de',
  'arcor.de',
  'mail.de',
]

function EmailSuggestDropdown({
  draft,
  onPick,
  visible,
}: {
  draft: string
  onPick: (complete: string) => void
  visible: boolean
}) {
  if (!visible) return null
  const atIdx = draft.lastIndexOf('@')
  if (atIdx < 0) return null
  const localPart = draft.slice(0, atIdx)
  const partialDomain = draft.slice(atIdx + 1).toLowerCase()
  if (!localPart) return null

  const matches = EMAIL_DOMAINS.filter((d) =>
    partialDomain ? d.startsWith(partialDomain) : true,
  ).slice(0, 6)
  if (matches.length === 0) return null

  return (
    <div
      className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
      onMouseDown={(e) => e.preventDefault()}
    >
      {matches.map((d, i) => (
        <button
          type="button"
          key={d}
          className={cn(
            'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition',
            i === 0 ? 'bg-slate-50' : 'hover:bg-slate-50',
          )}
          onClick={() => onPick(`${localPart}@${d}`)}
        >
          <Mail className="h-3 w-3 text-slate-400" />
          <span className="text-slate-700 truncate">
            <span className="text-slate-500">{localPart}</span>@{d}
          </span>
        </button>
      ))}
    </div>
  )
}

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
  const showEmailSuggest = inputType === 'email' && editing && draft.includes('@')

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
    if (splitFields) {
      const parts = draft.trim().split(/\s+/)
      const f = parts[0] ?? ''
      const l = parts.slice(1).join(' ')
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
      const fd = new FormData()
      fd.append('leadId', leadId)
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
        className="group/inline-edit flex-1 min-w-0"
        onClick={(e) => e.preventDefault()}
        onDoubleClick={() => setEditing(true)}
        title="Doppelklick zum Bearbeiten"
      >
        <div className="flex items-center gap-1 min-w-0">
          <div className="min-w-0 flex-1">{trigger}</div>
          <button
            type="button"
            aria-label="Bearbeiten"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setEditing(true)
            }}
            className="opacity-0 group-hover/inline-edit:opacity-100 transition-opacity shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-slate-400 hover:border-slate-200 hover:bg-white hover:text-slate-700"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative w-full z-20 fade-slide-up" onClick={(e) => e.preventDefault()}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleSave()
        }}
        className="flex items-center gap-1"
      >
        <div className="relative flex-1">
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
            autoComplete={inputType === 'email' ? 'email' : inputType === 'tel' ? 'tel' : 'off'}
          />
          <EmailSuggestDropdown
            draft={draft}
            onPick={(v) => {
              setDraft(v)
              validate(v)
              inputRef.current?.focus()
            }}
            visible={!!showEmailSuggest}
          />
        </div>
        <button
          type="submit"
          aria-label="Speichern"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          onClick={(e) => e.stopPropagation()}
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
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 sm:px-5 shadow-sm">
        <SkeletonShimmer className="h-3 w-28" />
        <SkeletonShimmer className="h-8 w-20" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="absolute inset-y-0 left-0 w-1 bg-slate-200" />
            <div className="flex gap-3 p-3.5 sm:p-4 pl-4">
              <SkeletonShimmer className="h-11 w-11 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1.5 flex-1">
                    <SkeletonShimmer className="h-4 w-3/4" />
                    <div className="flex items-center gap-1.5">
                      <SkeletonShimmer className="h-5 w-16 rounded-md" />
                      <SkeletonShimmer className="h-5 w-14 rounded-md" />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-right">
                    <SkeletonShimmer className="h-3 w-10 ml-auto" />
                    <SkeletonShimmer className="h-2.5 w-16 ml-auto" />
                  </div>
                </div>
                <div className="space-y-1.5 pt-0.5">
                  <SkeletonShimmer className="h-3 w-40" />
                  <SkeletonShimmer className="h-3 w-44" />
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100/80 bg-white/60 px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <SkeletonShimmer className="h-8 w-8 rounded-lg" />
                  <SkeletonShimmer className="h-8 w-8 rounded-lg" />
                </div>
                <SkeletonShimmer className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
