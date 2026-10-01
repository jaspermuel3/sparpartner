import Link from 'next/link'
import { requireSeller } from '@/lib/auth'
import { getMyLeads } from '@/lib/services/leads.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { NextLeadQuickButton } from '@/components/ui-custom/NextLeadQuickButton'
import {
  Input,
} from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Search,
  Filter,
  X,
  Calendar,
  UserPlus,
  ArrowUpDown,
  ChevronDown,
  Inbox,
  Clock,
  FileText,
  CheckCircle2,
  Ban,
  Zap,
} from 'lucide-react'
import {
  LEAD_STATUS_LABELS,
  PRODUCT_LABELS,
  LEAD_STATUS_CLASSES,
} from '@/lib/constants'
import type { LeadStatus, ProductType } from '@/types'
import { Suspense } from 'react'
import { StatusFilterSelect } from '@/components/ui-custom/StatusFilterSelect'
import { buildQueryString, cn } from '@/lib/utils'
import { LeadTableView, LeadTableSkeleton } from './LeadTableView'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const metadata = { title: 'Meine Leads' }

const ALL_PAGE_SIZES = [10, 25, 50, 100] as const

type CategoryKey = 'all' | 'open' | 'callback' | 'offer' | 'closed' | 'canceled'

const CATEGORIES: Array<{
  key: CategoryKey
  label: string
  statuses: LeadStatus[]
  dot: string
  ring: string
  activeBg: string
  activeText: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  {
    key: 'all',
    label: 'Alle',
    statuses: [],
    dot: 'bg-slate-400',
    ring: 'ring-slate-200',
    activeBg: 'bg-slate-900 text-white border-slate-900',
    activeText: 'text-slate-700',
    icon: Inbox,
  },
  {
    key: 'open',
    label: 'Offen',
    statuses: ['new', 'assigned', 'contacted'],
    dot: 'bg-blue-500',
    ring: 'ring-blue-200',
    activeBg: 'bg-blue-600 text-white border-blue-600',
    activeText: 'text-blue-700',
    icon: Zap,
  },
  {
    key: 'callback',
    label: 'Rückruf',
    statuses: ['callback'],
    dot: 'bg-orange-500',
    ring: 'ring-orange-200',
    activeBg: 'bg-orange-600 text-white border-orange-600',
    activeText: 'text-orange-700',
    icon: Clock,
  },
  {
    key: 'offer',
    label: 'Angebot',
    statuses: ['offer'],
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-200',
    activeBg: 'bg-indigo-600 text-white border-indigo-600',
    activeText: 'text-indigo-700',
    icon: FileText,
  },
  {
    key: 'closed',
    label: 'Erledigt',
    statuses: ['closed'],
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-200',
    activeBg: 'bg-emerald-600 text-white border-emerald-600',
    activeText: 'text-emerald-700',
    icon: CheckCircle2,
  },
  {
    key: 'canceled',
    label: 'Abgebrochen',
    statuses: ['no_interest', 'wrong_data', 'canceled'],
    dot: 'bg-slate-500',
    ring: 'ring-slate-200',
    activeBg: 'bg-slate-700 text-white border-slate-700',
    activeText: 'text-slate-600',
    icon: Ban,
  },
]

function getActiveCategory(statusFilter: LeadStatus[]): CategoryKey {
  if (statusFilter.length === 0) return 'all'
  for (const cat of CATEGORIES) {
    if (cat.key === 'all') continue
    const s = new Set(statusFilter)
    const c = new Set(cat.statuses)
    if (s.size === c.size && [...s].every((x) => c.has(x))) return cat.key
  }
  return 'all'
}

export default async function MyLeadsPage({
  searchParams,
}: {
  searchParams: {
    q?: string
    status?: string
    product?: string
    sort?: string
    dir?: 'asc' | 'desc'
    from?: string
    to?: string
    page?: string
    pageSize?: string
  }
}) {
  const user = await requireSeller()
  const q = searchParams.q ?? ''
  const statusFilter = searchParams.status ? (searchParams.status.split(',').filter(Boolean) as LeadStatus[]) : []
  const productFilter = searchParams.product ? (searchParams.product.split(',').filter(Boolean) as ProductType[]) : []

  const rawSort = searchParams.sort ?? 'assigned_at_desc'
  const lastUnderscore = rawSort.lastIndexOf('_')
  const parsedSortBy = lastUnderscore > 0 ? rawSort.slice(0, lastUnderscore) : 'assigned_at'
  const parsedSortDir = lastUnderscore > 0 ? rawSort.slice(lastUnderscore + 1) : 'desc'
  const sortBy = (['assigned_at', 'created_at', 'status'].includes(parsedSortBy) ? parsedSortBy : 'assigned_at') as string
  const sortDir = (parsedSortDir === 'asc' || parsedSortDir === 'desc' ? parsedSortDir : 'desc') as 'asc' | 'desc'

  const page = Math.max(1, Number(searchParams.page ?? '1') || 1)
  const parsedPageSize = Number(searchParams.pageSize ?? '25') || 25
  const pageSize = ALL_PAGE_SIZES.includes(parsedPageSize as any) ? parsedPageSize : 25

  const res = await getMyLeads(user.id, {
    search: q || undefined,
    statuses: statusFilter.length > 0 ? statusFilter : undefined,
    sortBy,
    sortDir,
    from: searchParams.from || undefined,
    to: searchParams.to || undefined,
    page,
    pageSize,
  })

  const totalPages = Math.max(1, Math.ceil(res.count / pageSize))
  const statuses: LeadStatus[] = ['new', 'assigned', 'contacted', 'callback', 'offer', 'closed', 'no_interest', 'wrong_data', 'canceled']
  const products: ProductType[] = ['strom', 'gas', 'beides']

  const activeCategory = getActiveCategory(statusFilter)

  const activeChips: Array<{ label: string; clearQs: Record<string, string | undefined> }> = []
  if (q) {
    activeChips.push({
      label: `Suche: "${q}"`,
      clearQs: { q: undefined },
    })
  }
  if (productFilter.length > 0 && activeCategory === 'all') {
    for (const s of statusFilter) {
      activeChips.push({
        label: `Status: ${LEAD_STATUS_LABELS[s]}`,
        clearQs: {
          status: statusFilter.filter((x) => x !== s).join(',') || undefined,
        },
      })
    }
  }
  for (const p of productFilter) {
    activeChips.push({
      label: `Produkt: ${PRODUCT_LABELS[p]}`,
      clearQs: {
        product: productFilter.filter((x) => x !== p).join(',') || undefined,
      },
    })
  }
  if (searchParams.from) {
    activeChips.push({
      label: `Von: ${searchParams.from}`,
      clearQs: { from: undefined },
    })
  }
  if (searchParams.to) {
    activeChips.push({
      label: `Bis: ${searchParams.to}`,
      clearQs: { to: undefined },
    })
  }

  const sortFields: Array<{ id: string; label: string }> = [
    { id: 'assigned_at_desc', label: 'Zugewiesen (neueste)' },
    { id: 'assigned_at_asc', label: 'Zugewiesen (älteste)' },
    { id: 'status_desc', label: 'Status (A→Z)' },
    { id: 'created_at_desc', label: 'Erstellt (neueste)' },
  ]

  const currentSortId = rawSort

  return (
    <div className="space-y-5">
      <PageHeader
        title="Meine Leads"
        description={`${res.count} Leads insgesamt. Du siehst nur deine zugewiesenen Leads.`}
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Meine Leads' },
        ]}
        actions={
          <>
            <NextLeadQuickButton />
            <Link
              href="/request-lead"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Lead anfordern
            </Link>
          </>
        }
      />

      <div className="space-y-4">
        <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100">
            <div className="flex items-center gap-1 overflow-x-auto px-3 py-2 sm:px-4">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.key
                const Icon = cat.icon
                const href =
                  cat.key === 'all'
                    ? `/my-leads${buildQueryString({ ...searchParams, status: undefined }, { page: undefined })}`
                    : `/my-leads${buildQueryString({ ...searchParams, status: cat.statuses.join(',') }, { page: undefined })}`
                return (
                  <Link
                    key={cat.key}
                    href={href}
                    className={cn(
                      'relative inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                      isActive
                        ? `${cat.activeBg} shadow-sm`
                        : `border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 ${cat.activeText}`,
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex h-1.5 w-1.5 rounded-full ring-2 ring-offset-0.5',
                        cat.dot,
                        isActive ? 'ring-white/30' : cat.ring,
                      )}
                    />
                    <Icon className="h-3.5 w-3.5" />
                    <span>{cat.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          <CardContent className="p-3 sm:p-4">
            <form action="/my-leads" method="get" className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
                <div className="md:col-span-5 lg:col-span-5 relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    name="q"
                    defaultValue={q}
                    placeholder="Suche nach Name, Telefon, E-Mail…"
                    className="pl-9 h-10 text-sm"
                  />
                </div>

                <div className="md:col-span-3 lg:col-span-2">
                  <StatusFilterSelect
                    statuses={statuses}
                    defaultValue={statusFilter.join(',') || 'all'}
                    className="w-full"
                    name="status"
                    size="md"
                    placeholder="Status"
                  />
                </div>

                <div className="md:col-span-3 lg:col-span-2">
                  <StatusFilterSelect
                    statuses={products as any}
                    defaultValue={productFilter.join(',') || 'all'}
                    labels={PRODUCT_LABELS as any}
                    name="product"
                    className="w-full"
                    placeholder="Produkt"
                    size="md"
                  />
                </div>

                <div className="md:col-span-3 lg:col-span-3 flex items-end gap-2">
                  <div className="flex flex-1 items-center gap-1.5 text-xs text-slate-500">
                    <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <Select
                      name="sort"
                      defaultValue={
                        sortFields.find((f) => f.id === currentSortId)
                          ? currentSortId
                          : 'assigned_at_desc'
                      }
                    >
                      <SelectTrigger className="h-10 w-full border-slate-200 bg-white text-sm">
                        <SelectValue placeholder="Sortieren nach" />
                      </SelectTrigger>
                      <SelectContent align="end">
                        {sortFields.map((f) => (
                          <SelectItem key={f.id} value={f.id} className="text-xs">
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    <Calendar className="h-3.5 w-3.5" /> Zeitraum
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="date"
                      name="from"
                      defaultValue={searchParams.from}
                      className="h-9 w-[150px] text-xs sm:text-sm"
                    />
                    <span className="text-xs text-slate-400">bis</span>
                    <Input
                      type="date"
                      name="to"
                      defaultValue={searchParams.to}
                      className="h-9 w-[150px] text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  {Object.keys(searchParams).length > 0 ? (
                    <Link
                      href="/my-leads"
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      Zurücksetzen
                    </Link>
                  ) : null}
                  <Button type="submit" size="sm" variant="default" className="h-9 min-w-[110px]">
                    <Search className="h-3.5 w-3.5" />
                    <span className="ml-1">Filter anwenden</span>
                  </Button>
                </div>
              </div>

              {activeChips.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-400">
                    Aktiv:
                  </span>
                  {activeChips.map((chip, i) => {
                    const href = `/my-leads${buildQueryString({ ...searchParams, ...chip.clearQs }, { page: undefined })}`
                    return (
                      <Link
                        key={i}
                        href={href}
                        className="inline-flex min-h-[26px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10.5px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
                      >
                        {chip.label}
                        <X className="h-3 w-3 text-slate-400" />
                      </Link>
                    )
                  })}
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Suspense
          fallback={
            <div className="space-y-3">
              <LeadTableSkeleton />
            </div>
          }
        >
          <LeadTableView
            data={res.data as any}
            count={res.count}
            page={Math.min(page, totalPages)}
            pageSize={pageSize}
            searchParams={searchParams as any}
          />
        </Suspense>
      </div>
    </div>
  )
}
