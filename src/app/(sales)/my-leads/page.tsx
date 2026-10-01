import Link from 'next/link'
import { requireSeller } from '@/lib/auth'
import { getMyLeads } from '@/lib/services/leads.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { LeadStatusBadge } from '@/components/ui-custom/StatusBadges'
import {
  Input,
} from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Search,
  Filter,
  ArrowUpDown,
  X,
  Calendar,
} from 'lucide-react'
import {
  LEAD_STATUS_LABELS,
  PRODUCT_LABELS,
} from '@/lib/constants'
import type { LeadStatus, ProductType } from '@/types'
import { Suspense } from 'react'
import { StatusFilterSelect } from '@/components/ui-custom/StatusFilterSelect'
import { buildQueryString } from '@/lib/utils'
import { LeadTableView, LeadTableSkeleton } from './LeadTableView'

export const metadata = { title: 'Meine Leads' }

const ALL_PAGE_SIZES = [10, 25, 50, 100] as const

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
  const sortBy = searchParams.sort ?? 'assigned_at'
  const sortDir = (searchParams.dir ?? 'desc') as 'asc' | 'desc'
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

  const activeChips: Array<{ label: string; clearQs: Record<string, string | undefined>; color?: string }> = []
  if (q) {
    activeChips.push({
      label: `Suche: "${q}"`,
      clearQs: { q: undefined },
    })
  }
  for (const s of statusFilter) {
    activeChips.push({
      label: `Status: ${LEAD_STATUS_LABELS[s]}`,
      clearQs: {
        status: statusFilter.filter((x) => x !== s).join(',') || undefined,
      },
    })
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

  const hasFilter = activeChips.length > 0

  const sortFields: Array<{ id: string; label: string }> = [
    { id: 'created_at', label: 'Zugewiesen am' },
    { id: 'status', label: 'Status' },
    { id: 'assigned_at', label: 'Zugewiesen am' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meine Leads"
        description={`${res.count} Leads insgesamt. Du siehst nur deine zugewiesenen Leads.`}
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Meine Leads' },
        ]}
      />

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <form action="/my-leads" method="get" className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-2 flex-1 flex-wrap">
                <div className="relative flex-1 max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    name="q"
                    defaultValue={q}
                    placeholder="Suche nach Name, Telefon, E-Mail…"
                    className="pl-9"
                  />
                </div>
                <div className="flex items-end gap-2 flex-wrap">
                  <Filter className="h-4 w-4 text-slate-400 mb-2" />
                  <StatusFilterSelect
                    statuses={statuses}
                    defaultValue={statusFilter.join(',') || 'all'}
                    className="w-[180px]"
                    name="status"
                  />
                  <StatusFilterSelect
                    statuses={products as any}
                    defaultValue={productFilter.join(',') || 'all'}
                    labels={PRODUCT_LABELS as any}
                    name="product"
                    className="w-[160px]"
                    placeholder="Produkt"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <Input type="date" name="from" defaultValue={searchParams.from} className="w-auto" />
                  <span className="text-slate-400">bis</span>
                  <Input type="date" name="to" defaultValue={searchParams.to} className="w-auto" />
                </div>
              </div>
            </div>

            {activeChips.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                {activeChips.map((chip, i) => {
                  const href = `/my-leads${buildQueryString({ ...searchParams, ...chip.clearQs }, { page: undefined })}`
                  return (
                    <Link
                      key={i}
                      href={href}
                      className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    >
                      {chip.label}
                      <X className="h-3 w-3 text-slate-400" />
                    </Link>
                  )
                })}
                <Link
                  href="/my-leads"
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-full px-2.5 py-1 text-xs text-slate-500 hover:text-slate-900 hover:underline"
                >
                  Alle zurücksetzen
                </Link>
              </div>
            ) : null}

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <div className="text-xs text-slate-500">
                {!hasFilter ? <span>&nbsp;</span> : null}
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" variant="default">
                  <Search className="h-3.5 w-3.5" />
                  Filtern
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Suspense fallback={<Card className="border-slate-200 bg-white shadow-sm overflow-hidden"><LeadTableSkeleton /></Card>}>
        <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
          <LeadTableView
            data={res.data as any}
            count={res.count}
            page={Math.min(page, totalPages)}
            pageSize={pageSize}
            searchParams={searchParams as any}
          />
        </Card>
      </Suspense>
    </div>
  )
}
