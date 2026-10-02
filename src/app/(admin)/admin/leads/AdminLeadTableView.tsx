'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
  Phone,
  Mail,
  ArrowUpRight,
  AlertCircle,
  Layers,
  Snowflake,
  UserPlus,
  UserX,
  Zap,
  CalendarDays,
} from 'lucide-react'
import { LeadAvatar } from '@/components/ui-custom/LeadAvatar'
import { LeadStatusBadge } from '@/components/ui-custom/StatusBadges'
import {
  PRODUCT_LABELS,
  SOURCE_LABELS,
  formatDateShort,
  formatTime,
  formatRelative,
  formatPhone,
  formatDaysSince,
  leadAgeClass,
  phoneHref,
} from '@/lib/constants'
import { buildQueryString, cn } from '@/lib/utils'
import type { Lead, LeadStatus, ProductType } from '@/types'
import { SkeletonShimmer } from '@/components/ui-custom/SkeletonShimmer'
import { useRouter } from 'next/navigation'
import { HoldLeadDialog, AssignLeadDialog, ResetLeadDialog, DeleteLeadDialog } from './AdminLeadDialogs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type LeadLike = Lead & {
  email?: string | null
  phone?: string | null
  assigned_user?: { full_name?: string | null; email: string } | null
  hold_notes?: string | null
}

type SearchParamsLike = Record<string, string | undefined>

const PAGE_SIZES = [10, 25, 50, 100]
const STORAGE_KEY_PAGESIZE = 'crm:admin-leads:pagesize:v1'

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

export function AdminLeadTableView({
  data,
  count,
  page,
  pageSize: initialPageSize,
  searchParams,
  sellers,
}: {
  data: LeadLike[]
  count: number
  page: number
  pageSize: number
  searchParams: SearchParamsLike
  sellers: readonly { id: string; full_name?: string | null; email: string }[]
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
    const qs = buildQueryString(searchParams, {
      page: targetPage === 1 ? undefined : String(targetPage),
      pageSize: String(pageSize),
    })
    router.push(`/admin/leads${qs}`)
  }

  function onChangePageSize(value: string) {
    const n = Number(value)
    if (!PAGE_SIZES.includes(n)) return
    setPageSize(n)
    const qs = buildQueryString(searchParams, { page: undefined, pageSize: String(n) })
    router.push(`/admin/leads${qs}`)
  }

  const detailUrl = (id: string) => `/leads/${id}`

  return (
    <TooltipProvider>
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
                Passe deine Filter an oder lege neue Leads an.
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
            const isDup = duplicates.has(lead.id)
            const staggerDelay = Math.min(600, 40 + idx * 40)
            const statusKey = lead.status as LeadStatus
            const url = detailUrl(lead.id)
            return (
              <div
                key={lead.id}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button, a, [role=combobox], input, textarea, [data-no-nav]')) return
                  router.push(url)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    if ((e.target as HTMLElement).closest('button, a, input, textarea, [role=combobox]')) return
                    e.preventDefault()
                    router.push(url)
                  }
                }}
                role="link"
                tabIndex={0}
                className={cn(
                  'group stagger-item relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2',
                  'transition-all duration-200 ease-out',
                  'hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300',
                  STATUS_SOFT_BG[statusKey] ?? 'bg-white',
                  lead.is_on_hold && 'opacity-80',
                )}
                style={{ animationDelay: `${staggerDelay}ms` }}
              >
                <div className={cn('absolute inset-y-0 left-0 w-1', STATUS_ACCENT[statusKey] ?? 'bg-slate-300')} />

                <div className="flex gap-3 p-3.5 sm:p-4 pl-4">
                  <div className="relative shrink-0">
                    <Link href={url} tabIndex={-1} onClick={(e) => e.stopPropagation()} className="block" aria-hidden="true">
                      <LeadAvatar firstName={lead.first_name} lastName={lead.last_name} size="md" className="h-11 w-11 ring-2 ring-white shadow-sm" />
                    </Link>
                    {lead.is_on_hold && (
                      <span
                        className="absolute -right-0.5 -bottom-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-sky-500 text-white shadow-sm"
                        title="Auf Eis gelegt"
                      >
                        <Snowflake className="h-2.5 w-2.5" />
                      </span>
                    )}
                    {!lead.is_on_hold && isDup ? (
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
                          <Link href={url} onClick={(e) => e.stopPropagation()} className="block truncate text-sm font-semibold text-slate-900 hover:underline decoration-slate-300 underline-offset-2">
                            {lead.first_name} {lead.last_name}
                          </Link>
                          {lead.is_on_hold ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700 cursor-help"
                                  onClick={(e) => e.preventDefault()}
                                >
                                  <Snowflake className="h-2.5 w-2.5" />
                                  Hold
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right" align="start">
                                <div className="text-xs">
                                  <div className="font-medium text-slate-900">Auf Eis gelegt</div>
                                  {lead.hold_notes && (
                                    <div className="text-slate-600 mt-1 max-w-xs whitespace-pre-wrap">{lead.hold_notes}</div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                          {!lead.is_on_hold && isDup ? (
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
                          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm">
                            {SOURCE_LABELS[lead.source as keyof typeof SOURCE_LABELS] ?? lead.source}
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
                          <a
                            href={phoneHref(lead.phone)}
                            onClick={(e) => e.stopPropagation()}
                            className="truncate text-xs text-slate-600 tabular-nums hover:text-slate-900 hover:underline decoration-slate-300 underline-offset-2"
                          >
                            {formatPhone(lead.phone)}
                          </a>
                        </div>
                      ) : null}
                      {lead.email ? (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                          <a
                            href={`mailto:${lead.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="truncate text-xs text-slate-600 hover:text-slate-900 hover:underline decoration-slate-300 underline-offset-2"
                          >
                            {lead.email}
                          </a>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="h-3 w-3 shrink-0 rounded-full border border-slate-200 bg-white" />
                        {lead.assigned_user ? (
                          <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-600">
                            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[8px] font-semibold text-slate-600">
                              {(lead.assigned_user.full_name ?? lead.assigned_user.email ?? '?').slice(0, 1).toUpperCase()}
                            </div>
                            <span className="truncate max-w-[140px]">
                              {lead.assigned_user.full_name ?? lead.assigned_user.email}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[10.5px] font-medium text-emerald-600">
                            Verfügbar
                          </span>
                        )}
                      </div>
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
                    <div data-no-nav>
                      <HoldLeadDialog
                        leadId={lead.id}
                        isOnHold={lead.is_on_hold}
                        currentNotes={lead.hold_notes ?? undefined}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mr-1">
                      Aktion
                    </span>
                    <div data-no-nav className="flex items-center gap-1">
                      {!lead.assigned_user_id ? (
                        <AssignLeadDialog leadId={lead.id} sellers={sellers as any} compact />
                      ) : (
                        <ResetLeadDialog leadId={lead.id} compact />
                      )}
                      <DeleteLeadDialog leadId={lead.id} compact />
                    </div>
                    <Link
                      href={url}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Lead öffnen"
                      title="Lead öffnen"
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
    </TooltipProvider>
  )
}

export function AdminLeadTableSkeleton() {
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
                  <SkeletonShimmer className="h-3 w-32" />
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100/80 bg-white/60 px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <SkeletonShimmer className="h-8 w-8 rounded-lg" />
                  <SkeletonShimmer className="h-8 w-8 rounded-lg" />
                  <SkeletonShimmer className="h-8 w-8 rounded-lg" />
                </div>
                <div className="flex items-center gap-1">
                  <SkeletonShimmer className="h-8 w-8 rounded-lg" />
                  <SkeletonShimmer className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
