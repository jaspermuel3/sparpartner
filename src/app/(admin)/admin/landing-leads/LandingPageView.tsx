'use client'

import Link from 'next/link'
import { useMemo, useState, useEffect, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  RefreshCw,
  Globe2,
  PhoneCall,
  Users,
  Banknote,
  UserPlus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  ListChecks,
  UserCheck,
  MoreHorizontal,
  FileText,
  ExternalLink,
  MapPin,
  Zap,
  Flame,
  Leaf,
  Download,
  RotateCcw,
} from 'lucide-react'
import {
  LEAD_STATUS_LABELS,
  STATUS_COLORS,
  PRODUCT_LABELS,
  SOURCE_LABELS,
  formatRelative,
} from '@/lib/constants'
import { cn, buildQueryString } from '@/lib/utils'
import { toast } from 'sonner'
import { createClient as createBrowserClient } from '@/lib/supabase/client'

export type InitialLandingFilters = {
  q: string
  product: ('strom' | 'gas' | 'beides')[]
  cons: 'all' | 'yes' | 'no'
  assign: 'all' | 'available' | 'assigned'
  status: string[]
  from: string
  to: string
  zip: string
  page: number
  pageSize: number
  sort: string
  dir: 'asc' | 'desc'
}

type Stats = {
  total_leads: number
  new_today: number
  new_yesterday: number
  delta_new_today_pct: number
  consultation_count: number
  consultation_rate_pct: number
  assigned_count: number
  contacted_count: number
  avg_savings_estimate_eur: number
  per_day_last_7: Array<{ date: string; count: number }>
  product_counts: Record<'strom' | 'gas' | 'beides', number>
  top_zips: Array<{ zip: string; count: number }>
  top_campaigns: Array<{ id: string; name: string | null; external_id: string | null; count: number }>
}

type LeadRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  zip: string | null
  city: string | null
  street: string | null
  product: 'strom' | 'gas' | 'beides'
  power_consumption: number | null
  gas_consumption: number | null
  status: any
  token_cost: number | null
  assigned_user_id: string | null
  assigned_user?: { id: string; full_name: string | null; email?: string | null } | null
  campaign_id: string | null
  campaign?: { id: string; name: string | null; external_id: string | null } | null
  created_at: string
  updated_at: string | null
  notes?: string | null
  wants_consultation?: boolean
  savings_estimate_eur?: number
  source?: any
}

type Seller = { id: string; full_name: string | null; email?: string | null; is_active?: boolean }

export function LandingPageView({
  stats,
  list,
  sellers,
  campaigns,
  initialFilters,
}: {
  stats: Stats
  list: { rows: LeadRow[]; count: number; page: number; pageSize: number }
  sellers: Seller[]
  campaigns: any[]
  initialFilters: InitialLandingFilters
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [isRefreshing, startRefresh] = useTransition()

  const activeSellers = sellers.filter((s) => s.is_active !== false)

  const filters = useMemo<InitialLandingFilters>(() => {
    const sp = searchParams
    const productArr = (sp?.get('product') ?? initialFilters.product.join(','))
      .split(',')
      .filter((x) => x === 'strom' || x === 'gas' || x === 'beides') as ('strom' | 'gas' | 'beides')[]
    return {
      q: sp?.get('q') ?? initialFilters.q,
      product: productArr,
      cons: (sp?.get('cons') as any) ?? initialFilters.cons,
      assign: (sp?.get('assign') as any) ?? initialFilters.assign,
      status: (sp?.get('status') ?? initialFilters.status.join(',')).split(',').filter(Boolean),
      from: sp?.get('from') ?? initialFilters.from,
      to: sp?.get('to') ?? initialFilters.to,
      zip: sp?.get('zip') ?? initialFilters.zip,
      page: Number(sp?.get('page') ?? initialFilters.page),
      pageSize: Number(sp?.get('pageSize') ?? initialFilters.pageSize),
      sort: sp?.get('sort') ?? initialFilters.sort,
      dir: (sp?.get('dir') as any) ?? initialFilters.dir,
    }
  }, [searchParams, initialFilters])

  const setFilters = (patch: Partial<InitialLandingFilters>) => {
    const next: InitialLandingFilters = { ...filters, ...patch }
    if ('pageSize' in patch || 'q' in patch || 'product' in patch || 'cons' in patch || 'assign' in patch || 'status' in patch || 'from' in patch || 'to' in patch || 'zip' in patch) {
      next.page = 1
    }
    const qs = buildQueryString({
      q: next.q || undefined,
      product: next.product.length > 0 ? next.product.join(',') : undefined,
      cons: next.cons === 'all' ? undefined : next.cons,
      assign: next.assign === 'all' ? undefined : next.assign,
      status: next.status.length > 0 ? next.status.join(',') : undefined,
      from: next.from || undefined,
      to: next.to || undefined,
      zip: next.zip || undefined,
      page: next.page > 1 ? String(next.page) : undefined,
      pageSize: next.pageSize !== 25 ? String(next.pageSize) : undefined,
      sort: next.sort || undefined,
      dir: next.dir === 'desc' ? undefined : next.dir,
    })
    router.push(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  const resetFilters = () => {
    router.push(pathname, { scroll: false })
  }

  const totalPages = Math.max(1, Math.ceil(list.count / filters.pageSize))
  const showPagination = list.count > filters.pageSize

  const doRefresh = () => {
    startRefresh(() => {
      router.refresh()
    })
  }

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Landing Leads"
        description="Alle Leads von Sparpartner24 Landing Page mit persönlicher telefonischer Beratung."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={doRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn('mr-1.5 h-4 w-4', isRefreshing && 'animate-spin')} />
              Aktualisieren
            </Button>
            <Link href="/admin/campaigns" className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              Kampagnen
            </Link>
          </div>
        }
      />

      <KpiCards stats={stats} />

      <RightRail
        stats={stats}
        campaigns={campaigns}
      />

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-0 border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                Lead-Übersicht
              </CardTitle>
              <CardDescription className="mt-1 text-xs text-slate-500 sm:text-sm">
                {list.count.toLocaleString('de-DE')} Treffer · Seite {filters.page} / {totalPages}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ListChecks className="mr-1.5 h-4 w-4" />
                    Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Nach Status filtern</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto p-2">
                    <StatusChipFilters
                      active={filters.status}
                      onChange={(arr) => setFilters({ status: arr })}
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ArrowUpDown className="mr-1.5 h-4 w-4" />
                    Sortierung
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={`${filters.sort || 'created_at'}:${filters.dir}`}
                    onValueChange={(v) => {
                      const [sort, dir] = v.split(':') as [string, 'asc' | 'desc']
                      setFilters({ sort, dir })
                    }}
                  >
                    <DropdownMenuRadioItem value="created_at:desc">Neuste zuerst</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="created_at:asc">Älteste zuerst</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="updated_at:desc">Zuletzt aktualisiert</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="last_name:asc">Name A–Z</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="zip:asc">PLZ aufsteigend</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="savings_estimate_eur:desc">Sparpotenzial ↓</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Filter zurücksetzen
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4 sm:p-5">
          <FilterGrid
            filters={filters}
            onChange={setFilters}
            activeSellers={activeSellers}
          />

          <LeadTable
            rows={list.rows}
            activeSellers={activeSellers}
            onChanged={() => doRefresh()}
            sort={filters.sort || 'created_at'}
            dir={filters.dir}
            onSort={(s) => {
              if (filters.sort === s) {
                setFilters({ dir: filters.dir === 'desc' ? 'asc' : 'desc' })
              } else {
                setFilters({ sort: s, dir: 'desc' })
              }
            }}
          />

          {showPagination && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Seitengröße:</span>
                <Select
                  value={String(filters.pageSize)}
                  onValueChange={(v) => setFilters({ pageSize: Number(v) })}
                >
                  <SelectTrigger className="h-9 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} pro Seite</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setFilters({ page: 1 })}
                  disabled={filters.page <= 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setFilters({ page: filters.page - 1 })}
                  disabled={filters.page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[5rem] text-center text-xs text-slate-500">
                  Seite {filters.page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setFilters({ page: filters.page + 1 })}
                  disabled={filters.page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setFilters({ page: totalPages })}
                  disabled={filters.page >= totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <QuickActionsCard
        availableCount={stats.total_leads - stats.assigned_count}
        activeSellers={activeSellers}
        onFinished={() => doRefresh()}
      />
    </div>
  )
}

export function LandingPageSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="border-slate-200">
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-44" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-slate-200">
        <CardHeader className="space-y-0 border-b border-slate-100 p-5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-1 h-3 w-72" />
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="divide-y divide-slate-100">
              {[0, 1, 2, 3, 4].map((r) => (
                <div key={r} className="grid grid-cols-12 gap-3 p-3">
                  <Skeleton className="col-span-3 h-4" />
                  <Skeleton className="col-span-2 h-4" />
                  <Skeleton className="col-span-2 h-4" />
                  <Skeleton className="col-span-2 h-4" />
                  <Skeleton className="col-span-2 h-4" />
                  <Skeleton className="col-span-1 h-8 justify-self-end" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FilterGrid({
  filters,
  onChange,
}: {
  filters: InitialLandingFilters
  onChange: (patch: Partial<InitialLandingFilters>) => void
  activeSellers: Seller[]
}) {
  const products: Array<{ key: 'strom' | 'gas' | 'beides'; label: string; icon: any }> = [
    { key: 'strom', label: 'Strom', icon: Zap },
    { key: 'gas', label: 'Gas', icon: Flame },
    { key: 'beides', label: 'Beides', icon: Leaf },
  ]

  const toggleProduct = (p: 'strom' | 'gas' | 'beides') => {
    const next = filters.product.includes(p)
      ? filters.product.filter((x) => x !== p)
      : [...filters.product, p]
    onChange({ product: next })
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-6 lg:grid-cols-12">
      <div className="md:col-span-3 lg:col-span-4">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Suche
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Name, Telefon, E-Mail, Ort, PLZ"
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            className="h-10 pl-9 pr-9"
          />
          {filters.q && (
            <button
              type="button"
              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              onClick={() => onChange({ q: '' })}
              aria-label="Suche löschen"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="md:col-span-3 lg:col-span-4">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Produkt
        </label>
        <div className="flex h-10 flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1">
          {products.map((p) => {
            const Icon = p.icon
            const active = filters.product.includes(p.key)
            return (
              <button
                type="button"
                key={p.key}
                onClick={() => toggleProduct(p.key)}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium transition',
                  active
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="md:col-span-2 lg:col-span-2">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Beratung
        </label>
        <Select
          value={filters.cons}
          onValueChange={(v) => onChange({ cons: v as any })}
        >
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="yes">Mit Beratungswunsch</SelectItem>
            <SelectItem value="no">Ohne Beratungswunsch</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="md:col-span-2 lg:col-span-2">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Zuweisung
        </label>
        <Select
          value={filters.assign}
          onValueChange={(v) => onChange({ assign: v as any })}
        >
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="available">Unzugewiesen</SelectItem>
            <SelectItem value="assigned">Zugewiesen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="md:col-span-2 lg:col-span-3">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          PLZ
        </label>
        <Input
          placeholder="10115"
          maxLength={10}
          value={filters.zip}
          onChange={(e) => onChange({ zip: e.target.value })}
          className="h-10"
        />
      </div>

      <div className="md:col-span-2 lg:col-span-3">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Von
        </label>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => onChange({ from: e.target.value })}
            className="h-10 pl-9"
          />
        </div>
      </div>

      <div className="md:col-span-2 lg:col-span-3">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Bis
        </label>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => onChange({ to: e.target.value })}
            className="h-10 pl-9"
          />
        </div>
      </div>

      <div className="md:col-span-2 lg:col-span-3 flex items-end">
        <div className="flex w-full flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-1.5">
          <Filter className="ml-1 mr-1 h-3.5 w-3.5 text-slate-400" />
          <ActiveFilterChips filters={filters} onChange={onChange} />
        </div>
      </div>
    </div>
  )
}

function ActiveFilterChips({
  filters,
  onChange,
}: {
  filters: InitialLandingFilters
  onChange: (patch: Partial<InitialLandingFilters>) => void
}) {
  const chips: Array<{ key: string; label: string; onClear: () => void }> = []
  if (filters.status.length > 0) {
    chips.push({
      key: 'status',
      label: `${filters.status.length} Status`,
      onClear: () => onChange({ status: [] }),
    })
  }
  if (filters.assign !== 'all') {
    chips.push({
      key: 'assign',
      label: filters.assign === 'available' ? 'Unzugewiesen' : 'Zugewiesen',
      onClear: () => onChange({ assign: 'all' }),
    })
  }
  if (filters.cons !== 'all') {
    chips.push({
      key: 'cons',
      label: filters.cons === 'yes' ? 'Mit Beratung' : 'Ohne Beratung',
      onClear: () => onChange({ cons: 'all' }),
    })
  }
  if (chips.length === 0) {
    return <span className="text-xs text-slate-500">Keine aktiven Filter</span>
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {chips.map((c) => (
        <Badge
          key={c.key}
          variant="secondary"
          className="gap-1 border-slate-200 bg-white pl-2 text-slate-700 hover:bg-slate-100"
        >
          {c.label}
          <button onClick={c.onClear} className="inline-flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-700" aria-label={`${c.label} entfernen`}>
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}

function StatusChipFilters({
  active,
  onChange,
}: {
  active: string[]
  onChange: (arr: string[]) => void
}) {
  const entries = Object.entries(LEAD_STATUS_LABELS) as Array<[string, string]>
  const toggle = (key: string) => {
    onChange(
      active.includes(key) ? active.filter((x) => x !== key) : [...active, key],
    )
  }
  return entries.map(([key, label]) => {
    const on = active.includes(key)
    const cls = STATUS_COLORS[key as keyof typeof STATUS_COLORS]
    return (
      <button
        type="button"
        key={key}
        onClick={() => toggle(key)}
        className={cn(
          'flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition',
          on ? 'border-slate-300 bg-slate-100 text-slate-900' : 'border-transparent text-slate-600 hover:bg-slate-50',
        )}
      >
        <span className="inline-flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', cls.dot || 'bg-slate-400')} />
          {label}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-slate-400">
          {on ? 'aktiv' : ''}
        </span>
      </button>
    )
  })
}

function KpiCards({ stats }: { stats: Stats }) {
  const spark = stats.per_day_last_7
  const sparkMax = Math.max(1, ...spark.map((x) => x.count))

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Gesamte Landing Leads"
        value={stats.total_leads.toLocaleString('de-DE')}
        subtitle={`${stats.assigned_count} zugewiesen · ${stats.total_leads - stats.assigned_count} offen`}
        icon={Globe2}
        tone="slate"
      >
        <Sparkline data={spark} max={sparkMax} strokeColor="#64748b" />
      </KpiCard>

      <KpiCard
        label="Heute neu"
        value={`+${stats.new_today.toLocaleString('de-DE')}`}
        subtitle={`Vortag: ${stats.new_yesterday.toLocaleString('de-DE')}`}
        deltaPct={stats.delta_new_today_pct}
        icon={Sparkles}
        tone="emerald"
      >
        <Sparkline data={spark} max={sparkMax} strokeColor="#10b981" />
      </KpiCard>

      <KpiCard
        label="Beratung gewünscht"
        value={`${stats.consultation_rate_pct.toFixed(1).replace(/\.0$/, '')}%`}
        subtitle={`${stats.consultation_count.toLocaleString('de-DE')} von ${stats.total_leads.toLocaleString('de-DE')} Leads`}
        icon={PhoneCall}
        tone="amber"
      >
        <div className="flex flex-wrap gap-1.5 pt-2">
          {(['strom', 'gas', 'beides'] as const).map((k) => (
            <Badge key={k} variant="outline" className="bg-white text-[11px] font-medium text-slate-600">
              {PRODUCT_LABELS[k]} · {stats.product_counts[k].toLocaleString('de-DE')}
            </Badge>
          ))}
        </div>
      </KpiCard>

      <KpiCard
        label="Durchschn. Sparpotenzial"
        value={`${stats.avg_savings_estimate_eur.toLocaleString('de-DE')} €`}
        subtitle={`${stats.contacted_count.toLocaleString('de-DE')} bereits kontaktiert`}
        icon={Banknote}
        tone="lime"
      >
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>Zugewiesen</span>
            <span>
              {stats.total_leads === 0 ? '0%' : `${Math.round((stats.assigned_count / stats.total_leads) * 100)}%`}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-lime-400 to-emerald-600"
              style={{ width: `${stats.total_leads === 0 ? 0 : Math.min(100, Math.round((stats.assigned_count / stats.total_leads) * 100))}%` }}
            />
          </div>
        </div>
      </KpiCard>
    </div>
  )
}

function KpiCard({
  label,
  value,
  subtitle,
  deltaPct,
  icon: Icon,
  tone,
  children,
}: {
  label: string
  value: string
  subtitle?: string
  deltaPct?: number
  icon: any
  tone: 'slate' | 'emerald' | 'amber' | 'lime'
  children?: React.ReactNode
}) {
  const toneMap = {
    slate: 'text-slate-600 bg-slate-50 border-slate-200',
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
    lime: 'text-lime-800 bg-lime-50 border-lime-200',
  } as const
  const deltaPositive = (deltaPct ?? 0) >= 0
  return (
    <Card className={cn('border-slate-200 shadow-sm overflow-hidden')}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              {label}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {value}
              </div>
              {typeof deltaPct === 'number' && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    deltaPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
                  )}
                >
                  {deltaPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {Math.abs(deltaPct).toFixed(1).replace(/\.0$/, '')}%
                </span>
              )}
            </div>
            {subtitle && (
              <div className="mt-1.5 line-clamp-1 text-xs text-slate-500">{subtitle}</div>
            )}
          </div>
          <div className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', toneMap[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="pt-3">{children}</div>
      </CardContent>
    </Card>
  )
}

function Sparkline({ data, max, strokeColor = '#64748b' }: { data: Array<{ count: number }>; max: number; strokeColor?: string }) {
  const w = 240
  const h = 36
  const step = w / Math.max(1, data.length - 1)
  const path = data
    .map((d, i) => {
      const x = i * step
      const y = h - Math.max(2, (d.count / max) * (h - 4))
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
  return (
    <div className="pt-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full">
        <path d={path} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={strokeColor} opacity={0.08} />
      </svg>
    </div>
  )
}

function RightRail({
  stats,
  campaigns,
}: {
  stats: Stats
  campaigns: any[]
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="border-slate-200 shadow-sm lg:col-span-2">
        <CardHeader className="border-b border-slate-100 p-5">
          <CardTitle className="text-base font-semibold tracking-tight text-slate-900">
            Leads der letzten 7 Tage
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            {stats.per_day_last_7.reduce((s, d) => s + d.count, 0).toLocaleString('de-DE')} insgesamt in den letzten 7 Tagen
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <BarsChart data={stats.per_day_last_7} />
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 p-5">
          <CardTitle className="text-base font-semibold tracking-tight text-slate-900">
            Top PLZ-Regionen
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Dichte der Landing Leads nach Postleitzahl
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          {stats.top_zips.length === 0 ? (
            <div className="text-xs text-slate-500">Noch keine PLZ-Daten vorhanden.</div>
          ) : (
            <div className="space-y-2">
              {(() => {
                const maxZ = Math.max(1, ...stats.top_zips.map((z) => z.count))
                return stats.top_zips.map((z) => (
                  <div key={z.zip}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {z.zip}
                      </span>
                      <span className="text-slate-500">{z.count.toLocaleString('de-DE')}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-slate-300 to-slate-600" style={{ width: `${(z.count / maxZ) * 100}%` }} />
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Kampagnen
            </div>
            {stats.top_campaigns.length === 0 ? (
              <div className="text-xs text-slate-500">Noch keine Kampagnen zugeordnet.</div>
            ) : (
              <div className="space-y-1.5">
                {stats.top_campaigns.map((c) => {
                  const ext = campaigns.find((x: any) => x.id === c.id)?.external_id ?? c.external_id
                  return (
                    <Link
                      key={c.id}
                      href="/admin/campaigns"
                      className="flex items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-xs hover:bg-slate-50 hover:border-slate-200"
                    >
                      <span className="inline-flex min-w-0 flex-col">
                        <span className="truncate font-medium text-slate-800">
                          {c.name ?? ext ?? 'Kampagne'}
                        </span>
                        {ext && ext !== c.name && (
                          <span className="truncate text-[10px] uppercase tracking-wider text-slate-400">{ext}</span>
                        )}
                      </span>
                      <Badge variant="secondary" className="text-[11px] text-slate-600">
                        {c.count} Lead{c.count === 1 ? '' : 's'}
                      </Badge>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BarsChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const fmt = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(',', '')
  }
  return (
    <div className="flex h-44 items-end gap-2">
      {data.map((d, i) => {
        const h = Math.max(4, Math.round((d.count / max) * 100))
        const isLast = i === data.length - 1
        return (
          <div key={d.date} className="group relative flex flex-1 flex-col items-center justify-end">
            <div className="mb-2 text-[10px] font-semibold text-slate-500 opacity-0 transition group-hover:opacity-100">
              {d.count}
            </div>
            <div
              className={cn(
                'w-full rounded-t-md transition-all duration-300',
                isLast ? 'bg-gradient-to-t from-emerald-600 to-lime-400' : 'bg-gradient-to-t from-slate-400 to-slate-200 hover:from-emerald-500 hover:to-lime-300',
              )}
              style={{ height: `${h}%` }}
            />
            <div className="mt-2 text-[11px] text-slate-500">{fmt(d.date)}</div>
          </div>
        )
      })}
    </div>
  )
}

function LeadTable({
  rows,
  activeSellers,
  onChanged,
  sort,
  dir,
  onSort,
}: {
  rows: LeadRow[]
  activeSellers: Seller[]
  onChanged: () => void
  sort: string
  dir: 'asc' | 'desc'
  onSort: (key: string) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-14 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200">
          <Globe2 className="h-5 w-5 text-slate-400" />
        </div>
        <div className="text-sm font-semibold text-slate-700">Keine Landing Leads gefunden</div>
        <div className="max-w-sm text-xs text-slate-500">
          Passe die Filter an oder schaue später wieder vorbei, sobald neue Leads über die Sparpartner24 Landing Page eingehen.
        </div>
      </div>
    )
  }

  const SortHead = ({ label, key }: { label: string; key: string }) => {
    const on = sort === key || (key === 'created_at' && !sort)
    return (
      <button
        type="button"
        onClick={() => onSort(key)}
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
      >
        {label}
        {on ? (
          dir === 'asc' ? (
            <ArrowUp className="h-3 w-3 text-slate-700" />
          ) : (
            <ArrowDown className="h-3 w-3 text-slate-700" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 text-slate-400" />
        )}
      </button>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="px-4 py-3 text-left sm:px-5">
                <SortHead label="Lead" key="last_name" />
              </th>
              <th className="hidden px-4 py-3 text-left sm:table-cell sm:px-5">
                <SortHead label="Produkt" key="product" />
              </th>
              <th className="hidden px-4 py-3 text-left lg:table-cell lg:px-5">
                <SortHead label="Ort" key="zip" />
              </th>
              <th className="hidden px-4 py-3 text-left md:table-cell md:px-5">
                <SortHead label="Beratung" key="notes" />
              </th>
              <th className="hidden px-4 py-3 text-right xl:table-cell xl:px-5">
                <SortHead label="Sparpot." key="savings_estimate_eur" />
              </th>
              <th className="px-4 py-3 text-left sm:px-5">
                <SortHead label="Status" key="status" />
              </th>
              <th className="hidden px-4 py-3 text-left lg:table-cell lg:px-5">Zugewiesen an</th>
              <th className="px-4 py-3 text-right sm:px-5">
                <SortHead label="Eingang" key="created_at" />
              </th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {rows.map((r) => (
              <LeadRowView
                key={r.id}
                row={r}
                activeSellers={activeSellers}
                onChanged={onChanged}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LeadRowView({
  row,
  activeSellers,
  onChanged,
}: {
  row: LeadRow
  activeSellers: Seller[]
  onChanged: () => void
}) {
  const [pending, setPending] = useState(false)
  const supabase = createBrowserClient()
  const router = useRouter()

  const assignSeller = async (userId: string) => {
    if (pending) return
    setPending(true)
    try {
      const { error } = await supabase.rpc('assign_lead_to_seller', {
        p_lead_id: row.id,
        p_seller_id: userId,
        p_by_user_id: null as any,
        p_debit_tokens: true,
      })
      if (error) throw error
      toast.success('Lead wurde zugewiesen.')
      onChanged()
    } catch (e: any) {
      const msg = e?.message ?? 'Zuweisung fehlgeschlagen.'
      toast.error(msg)
    } finally {
      setPending(false)
      router.refresh()
    }
  }

  const statusCls = STATUS_COLORS[row.status as keyof typeof STATUS_COLORS] ?? {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    dot: 'bg-slate-400',
  }

  return (
    <tr className="group transition hover:bg-slate-50/70">
      <td className="px-4 py-3 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lime-100 to-emerald-100 text-xs font-bold uppercase text-emerald-800 ring-1 ring-emerald-200">
            {initials(row.first_name, row.last_name)}
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2">
              <Link
                href={`/leads/${row.id}`}
                className="truncate font-semibold text-slate-900 hover:underline underline-offset-2"
              >
                {[row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unbekannter Lead'}
              </Link>
              <SourceBadge source={row.source ?? 'landing_page'} />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
              {row.phone && (
                <a href={`tel:${row.phone}`} className="hover:text-slate-700">
                  {row.phone}
                </a>
              )}
              {row.email && (
                <a href={`mailto:${row.email}`} className="truncate hover:text-slate-700">
                  {row.email}
                </a>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">
              <ProductBadge product={row.product} power={row.power_consumption} gas={row.gas_consumption} />
              {row.wants_consultation ? (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] font-medium text-amber-800">
                  Beratung gewünscht
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </td>
      <td className="hidden px-4 py-3 sm:table-cell sm:px-5 align-top">
        <ProductBadge product={row.product} power={row.power_consumption} gas={row.gas_consumption} />
      </td>
      <td className="hidden px-4 py-3 align-top text-xs text-slate-600 lg:table-cell lg:px-5">
        <div className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          {[row.zip, row.city].filter(Boolean).join(' ') || <span className="text-slate-400">–</span>}
        </div>
      </td>
      <td className="hidden px-4 py-3 align-top md:table-cell md:px-5">
        {row.wants_consultation ? (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[11px] font-semibold text-amber-800">
            <PhoneCall className="mr-1 h-3 w-3" />
            Rückruf gewünscht
          </Badge>
        ) : (
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[11px] text-slate-600">
            Kein Rückruf
          </Badge>
        )}
      </td>
      <td className="hidden px-4 py-3 align-top text-right xl:table-cell xl:px-5">
        <div className="inline-flex items-baseline gap-0.5">
          <span className="text-sm font-bold text-emerald-700">
            {row.savings_estimate_eur?.toLocaleString('de-DE') ?? 0}
          </span>
          <span className="text-[11px] text-slate-500">€</span>
        </div>
      </td>
      <td className="px-4 py-3 align-top sm:px-5">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset', statusCls.bg, statusCls.text, 'ring-black/5')}>
          <span className={cn('h-1.5 w-1.5 rounded-full', statusCls.dot)} />
          {LEAD_STATUS_LABELS[row.status as keyof typeof LEAD_STATUS_LABELS] ?? String(row.status)}
        </span>
        {row.campaign?.name && (
          <div className="mt-1 text-[11px] text-slate-500">
            Kampagne: {row.campaign.name}
          </div>
        )}
      </td>
      <td className="hidden px-4 py-3 align-top lg:table-cell lg:px-5">
        {row.assigned_user ? (
          <div className="flex items-center gap-2">
            <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold uppercase text-white">
              {initials(row.assigned_user.full_name ?? '', '')}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-slate-800">
                {row.assigned_user.full_name || row.assigned_user.id.slice(0, 8)}
              </div>
              {row.assigned_user.email && (
                <div className="truncate text-[11px] text-slate-500">{row.assigned_user.email}</div>
              )}
            </div>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={pending || activeSellers.length === 0}>
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                {pending ? '…' : 'Zuweisen'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Schnellzuweisung</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {activeSellers.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-slate-500">Keine aktiven Benutzer vorhanden.</div>
                ) : (
                  activeSellers.map((s) => (
                    <DropdownMenuRadioItem key={s.id} value={s.id} onSelect={() => assignSeller(s.id)}>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-800">{s.full_name ?? s.id.slice(0, 8)}</span>
                        {s.email && <span className="text-[11px] text-slate-500">{s.email}</span>}
                      </div>
                    </DropdownMenuRadioItem>
                  ))
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
      <td className="px-4 py-3 text-right align-top sm:px-5">
        <div className="text-xs font-medium text-slate-800">{formatRelative(row.created_at)}</div>
        <div className="text-[11px] text-slate-500">
          {new Date(row.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </td>
      <td className="px-3 py-3 text-right align-top">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/leads/${row.id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Lead öffnen"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-800">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <Link
                  href={`/leads/${row.id}`}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
                >
                  <FileText className="h-4 w-4 text-slate-500" />
                  Detailansicht öffnen
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (row.phone) {
                      window.location.href = `tel:${row.phone}`
                    }
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                  disabled={!row.phone}
                >
                  <PhoneCall className="h-4 w-4 text-emerald-600" />
                  Anrufen
                </button>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(row.phone ?? '')}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                >
                  <UserCheck className="h-4 w-4 text-slate-500" />
                  Telefonnummer kopieren
                </button>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  )
}

function ProductBadge({
  product,
  power,
  gas,
}: {
  product: 'strom' | 'gas' | 'beides'
  power: number | null
  gas: number | null
}) {
  const color =
    product === 'strom'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : product === 'gas'
        ? 'border-sky-200 bg-sky-50 text-sky-800'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
  const Icon = product === 'strom' ? Zap : product === 'gas' ? Flame : Leaf
  return (
    <div className="flex flex-col gap-1">
      <span className={cn('inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold', color)}>
        <Icon className="h-3 w-3" />
        {PRODUCT_LABELS[product]}
      </span>
      <div className="flex flex-wrap gap-1 text-[11px] text-slate-500">
        {power != null && (
          <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5">{power.toLocaleString('de-DE')} kWh Strom</span>
        )}
        {gas != null && (
          <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5">{gas.toLocaleString('de-DE')} kWh Gas</span>
        )}
      </div>
    </div>
  )
}

function SourceBadge({ source }: { source: any }) {
  const label = (SOURCE_LABELS as any)[source] ?? 'Sonstiges'
  return (
    <span className="inline-flex items-center rounded-md border border-lime-200 bg-lime-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-lime-800">
      {label}
    </span>
  )
}

function initials(a: string | null, b: string | null) {
  const x = (a ?? '').trim().charAt(0).toUpperCase()
  const y = (b ?? '').trim().charAt(0).toUpperCase()
  return (x + y) || '??'
}

function QuickActionsCard({
  availableCount,
  activeSellers,
  onFinished,
}: {
  availableCount: number
  activeSellers: Seller[]
  onFinished: () => void
}) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [pending, setPending] = useState(false)

  const availableIds = (window as any).__landingAvailableIds as string[] | undefined

  const distributeRotating = async () => {
    if (availableCount === 0) {
      toast.error('Keine unzugewiesenen Landing Leads im aktuellen Filter.')
      return
    }
    if (activeSellers.length === 0) {
      toast.error('Keine aktiven Benutzer für die Zuweisung vorhanden.')
      return
    }
    setPending(true)
    toast.message('Verteilung wird angestoßen…', { description: 'Bereite schnelle Round-Robin-Zuweisung vor.' })
    try {
      const { data, error: listErr } = await supabase
        .from('leads')
        .select('id')
        .or('source.eq.landing_page,source.eq.sonstiges')
        .is('assigned_user_id', null)
        .order('created_at', { ascending: true })
        .limit(50)
      if (listErr) throw listErr
      const ids = ((data as any[]) ?? []).map((r) => r.id as string)
      if (ids.length === 0) throw new Error('Keine offenen Leads gefunden.')

      let successCount = 0
      let errorCount = 0
      for (let i = 0; i < ids.length; i++) {
        const sellerIndex = i % activeSellers.length
        const seller = activeSellers[sellerIndex]
        try {
          const { error } = await supabase.rpc('assign_lead_to_seller', {
            p_lead_id: ids[i],
            p_seller_id: seller.id,
            p_by_user_id: null as any,
            p_debit_tokens: true,
          })
          if (error) throw error
          successCount++
        } catch {
          errorCount++
        }
      }
      if (successCount > 0) {
        toast.success(`${successCount} Lead${successCount === 1 ? '' : 's'} zugewiesen.${errorCount > 0 ? ` ${errorCount} fehlgeschlagen.` : ''}`)
      } else {
        toast.error('Zuweisung fehlgeschlagen.')
      }
      onFinished()
    } catch (e: any) {
      toast.error(e?.message ?? 'Verteilung fehlgeschlagen.')
    } finally {
      setPending(false)
      router.refresh()
    }
  }

  const exportCsv = async () => {
    setPending(true)
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, created_at, first_name, last_name, phone, email, zip, city, product, power_consumption, gas_consumption, status, assigned_user_id, source, notes')
        .or('source.eq.landing_page,source.eq.sonstiges')
        .order('created_at', { ascending: false })
        .limit(2500)
      if (error) throw error
      const rows = (data ?? []) as any[]
      const headers = ['Eingang', 'Vorname', 'Nachname', 'Telefon', 'E-Mail', 'PLZ', 'Ort', 'Produkt', 'Strom (kWh)', 'Gas (kWh)', 'Status', 'Quelle', 'Beratung']
      const lines: string[] = [headers.join(';')]
      for (const r of rows) {
        lines.push(
          [
            new Date(r.created_at).toLocaleString('de-DE'),
            csvEscape(r.first_name),
            csvEscape(r.last_name),
            csvEscape(r.phone),
            csvEscape(r.email),
            csvEscape(r.zip),
            csvEscape(r.city),
            csvEscape(PRODUCT_LABELS[r.product as keyof typeof PRODUCT_LABELS] ?? r.product),
            r.power_consumption ?? '',
            r.gas_consumption ?? '',
            csvEscape(LEAD_STATUS_LABELS[r.status as keyof typeof LEAD_STATUS_LABELS] ?? r.status),
            csvEscape((SOURCE_LABELS as any)[r.source] ?? r.source),
            String(r.notes ?? '').includes('Beratungsgespräch gewünscht') ? 'Ja' : 'Nein',
          ].join(';'),
        )
      }
      const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `landing-leads-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`${rows.length.toLocaleString('de-DE')} Zeilen als CSV exportiert.`)
    } catch (e: any) {
      toast.error(e?.message ?? 'CSV-Export fehlgeschlagen.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between border-b border-slate-100 p-5">
        <div>
          <CardTitle className="text-base font-semibold tracking-tight text-slate-900">
            Schnell-Aktionen
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Aktionen für alle Landing Leads mit Quelle Sparpartner24 / Landing Page.
          </CardDescription>
        </div>
        <Badge variant="outline" className="border-slate-200 bg-white text-[11px] text-slate-600">
          {availableCount} unzugewiesen
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3 p-5">
        <Button
          onClick={distributeRotating}
          disabled={pending || availableCount === 0 || activeSellers.length === 0}
          variant="default"
          className="bg-gradient-to-r from-emerald-600 to-lime-500 text-white shadow-sm hover:from-emerald-700 hover:to-lime-600"
        >
          <Users className="mr-2 h-4 w-4" />
          Automatisch rotierend verteilen
        </Button>
        <Button variant="outline" onClick={exportCsv} disabled={pending}>
          <Download className="mr-2 h-4 w-4" />
          CSV-Export (max. 2.500)
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/campaigns">
            <Sparkles className="mr-2 h-4 w-4" />
            Kampagnen verwalten
          </Link>
        </Button>
        <div className="ml-auto text-xs text-slate-500">
          Tipp: Einzelne Leads können direkt über die Tabelle pro Zeile zugewiesen werden.
        </div>
      </CardContent>
    </Card>
  )
}

function csvEscape(v: any) {
  if (v == null) return ''
  const s = String(v).replace(/"/g, '""')
  if (/[;"\n\r]/.test(s)) return `"${s}"`
  return s
}
