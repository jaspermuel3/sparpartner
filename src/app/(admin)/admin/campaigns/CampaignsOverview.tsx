'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  SOURCE_LABELS,
  formatCurrency,
  formatDateShort,
  formatPercent,
} from '@/lib/constants'
import {
  Target,
  DollarSign,
  Users,
  Sparkles,
  Pencil,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Filter,
  ChevronDown,
  Megaphone,
  Globe2,
  Search as SearchIcon,
  Boxes,
  HandHeart,
  CircleDollarSign,
  PlayCircle,
  CalendarClock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CreateCampaignDialog, EditCampaignDialog } from './CampaignDialogs'

export type CampaignSummary = {
  id: string
  name: string
  source: string | null
  external_id: string | null
  is_active: boolean
  budget_amount: number | null
  start_date: string | null
  end_date: string | null
  stats: {
    total: number
    assigned: number
    offer: number
    closed: number
    quote: number
    avgPower: number | null
    avgGas: number | null
  }
}

type SourceKey = 'all' | 'meta_ads' | 'landing_page' | 'google_ads' | 'manual' | 'import' | 'empfehlung' | 'sonstiges'

const SOURCE_TABS: Array<{ key: SourceKey; label: string; Icon: any; hint?: string }> = [
  { key: 'all', label: 'Alle', Icon: Boxes, hint: 'Alle Kampagnen' },
  { key: 'meta_ads', label: 'Meta Ads', Icon: Megaphone, hint: 'Facebook Lead Ads' },
  { key: 'landing_page', label: 'Landing Page', Icon: Globe2, hint: 'Landing Page Leads via UTM' },
  { key: 'google_ads', label: 'Google Ads', Icon: SearchIcon, hint: 'Google Ads / PPC' },
  { key: 'manual', label: 'Manuell', Icon: HandHeart, hint: 'Manuell angelegt' },
  { key: 'sonstiges', label: 'Sonstige', Icon: CircleDollarSign, hint: 'Import / Empfehlung etc.' },
]

function isCurrentlyRunning(c: CampaignSummary): boolean {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const start = c.start_date ? new Date(String(c.start_date)).getTime() : null
  const end = c.end_date ? new Date(String(c.end_date)).getTime() : null
  const started = start === null || start <= today
  const notEnded = end === null || end >= today
  return c.is_active && started && notEnded
}

export function CampaignsOverview({
  initialCampaigns,
}: {
  initialCampaigns: CampaignSummary[]
}) {
  const [activeSource, setActiveSource] = useState<SourceKey>('all')
  const [search, setSearch] = useState('')
  const [onlyActive, setOnlyActive] = useState(true)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = initialCampaigns.filter((c) => {
      if (activeSource !== 'all') {
        if (activeSource === 'sonstiges') {
          if (c.source === 'meta_ads' || c.source === 'landing_page' || c.source === 'google_ads' || c.source === 'manual') return false
        } else if (String(c.source ?? '') !== String(activeSource)) {
          return false
        }
      }
      if (onlyActive && !c.is_active) return false
      if (!q) return true
      const hay = [
        c.name,
        c.source ? SOURCE_LABELS[c.source as keyof typeof SOURCE_LABELS] ?? String(c.source) : '',
        c.external_id ?? '',
      ].join(' ').toLowerCase()
      return hay.includes(q)
    })

    return [...list].sort((a, b) => {
      const aRun = isCurrentlyRunning(a) ? 1 : 0
      const bRun = isCurrentlyRunning(b) ? 1 : 0
      if (aRun !== bRun) return bRun - aRun

      const aAct = a.is_active ? 1 : 0
      const bAct = b.is_active ? 1 : 0
      if (aAct !== bAct) return bAct - aAct

      const aStart = a.start_date ? new Date(String(a.start_date)).getTime() : 0
      const bStart = b.start_date ? new Date(String(b.start_date)).getTime() : 0
      if (bStart !== aStart) return bStart - aStart

      const aCreated = (a as any).created_at ? new Date(String((a as any).created_at)).getTime() : 0
      const bCreated = (b as any).created_at ? new Date(String((b as any).created_at)).getTime() : 0
      return bCreated - aCreated
    })
  }, [initialCampaigns, activeSource, search, onlyActive])

  const stats = useMemo(() => {
    const runningCount = filtered.filter((c) => isCurrentlyRunning(c)).length
    const activeCount = filtered.filter((c) => c.is_active).length
    const totalBudget = filtered.reduce((sum, c) => sum + (c.budget_amount ?? 0), 0)
    const totalLeads = filtered.reduce((sum, c) => sum + (c.stats?.total ?? 0), 0)
    const closedLeads = filtered.reduce((sum, c) => sum + (c.stats?.closed ?? 0), 0)
    return { runningCount, activeCount, totalBudget, totalLeads, closedLeads }
  }, [filtered])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCardWrap
          label="Laufend · Aktive Kampagnen"
          value={`${stats.runningCount} Laufend · ${stats.activeCount} Aktiv`}
          Icon={PlayCircle}
          accent="success"
        />
        <StatCardWrap
          label="Gesamt-Budget"
          value={stats.totalBudget ? `${formatCurrency(stats.totalBudget)} €` : '—'}
          Icon={DollarSign}
          accent="default"
        />
        <StatCardWrap
          label="Leads gesamt"
          value={stats.totalLeads}
          Icon={Users}
          accent="default"
        />
        <StatCardWrap
          label="Abschlüsse (gefiltert)"
          value={stats.closedLeads}
          Icon={Sparkles}
          accent="success"
        />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
          {SOURCE_TABS.map(({ key, label, Icon, hint }) => {
            const active = activeSource === key
            const count = useMemoLocalCount(initialCampaigns, key)
            return (
              <button
                key={key}
                onClick={() => setActiveSource(key)}
                title={hint}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition whitespace-nowrap',
                  active
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold tabular-nums',
                  active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600',
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded text-emerald-600 border-slate-300"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
            />
            Nur aktiv
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Suche nach Kampagnenname / ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full min-w-[260px] rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/5"
            />
          </div>
          <CreateCampaignDialog campaigns={initialCampaigns as any[]} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            Gefiltert: <span className="font-medium text-slate-700 tabular-nums">{filtered.length} Kampagnen</span>
            <span className="text-slate-300">·</span>
            <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
            Laufend: <span className="font-medium text-emerald-700 tabular-nums">{stats.runningCount}</span>
            <span className="text-slate-300">·</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            Quelle: <span className="font-medium text-slate-700">
              {SOURCE_TABS.find((t) => t.key === activeSource)?.label ?? 'Alle'}
            </span>
          </div>
          {onlyActive && (
            <div className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <CalendarClock className="h-3 w-3" />
              Nur aktive Kampagnen
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Kampagne</th>
                <th className="px-4 py-3 font-semibold">Quelle</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Budget</th>
                <th className="px-4 py-3 font-semibold text-right hidden md:table-cell">Leads</th>
                <th className="px-4 py-3 font-semibold text-right hidden lg:table-cell">Abschlüsse</th>
                <th className="px-4 py-3 font-semibold text-right hidden xl:table-cell">Quote</th>
                <th className="px-4 py-3 font-semibold text-right min-w-[110px]">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-center">
                      <Sparkles className="h-6 w-6 text-slate-300 mb-2" />
                      <div className="text-sm font-medium text-slate-700">
                        Keine Kampagnen in dieser Ansicht
                      </div>
                      <div className="text-xs text-slate-500 mt-1 max-w-sm">
                        Passe Filter oder Suche an, oder lege eine neue Kampagne an.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <CampaignRow key={c.id} campaign={c} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function useMemoLocalCount(list: CampaignSummary[], key: SourceKey) {
  return useMemo(() => {
    if (key === 'all') return list.length
    if (key === 'sonstiges') {
      return list.filter((c) => !(
        c.source === 'meta_ads' ||
        c.source === 'landing_page' ||
        c.source === 'google_ads' ||
        c.source === 'manual'
      )).length
    }
    return list.filter((c) => String(c.source ?? '') === String(key)).length
  }, [list, key])
}

function StatCardWrap({
  label,
  value,
  Icon,
  accent,
}: {
  label: string
  value: string | number
  Icon: any
  accent: 'default' | 'success' | 'warning' | 'danger'
}) {
  const border =
    accent === 'success'
      ? 'border-emerald-200 bg-emerald-50/40'
      : accent === 'warning'
        ? 'border-amber-200 bg-amber-50/40'
        : accent === 'danger'
          ? 'border-red-200 bg-red-50/40'
          : 'border-slate-200 bg-white'
  const iconColor =
    accent === 'success'
      ? 'text-emerald-600'
      : accent === 'warning'
        ? 'text-amber-600'
        : accent === 'danger'
          ? 'text-red-600'
          : 'text-slate-500'
  return (
    <div className={cn('rounded-xl border p-4 shadow-sm', border)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          <Icon className={cn('h-3.5 w-3.5', iconColor)} />
          {label}
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {value}
      </div>
    </div>
  )
}

function CampaignRow({ campaign }: { campaign: CampaignSummary }) {
  const stats = campaign.stats ?? ({} as CampaignSummary['stats'])
  const budget = Number(campaign.budget_amount ?? 0) || 0
  const assignedCount = stats.assigned ?? 0
  const usedBudget = assignedCount * 1
  const total = stats.total ?? 0
  const closed = stats.closed ?? 0
  const budgetPct = budget > 0 ? Math.min(1, usedBudget / budget) : 0
  const quote = stats.quote ?? 0
  const running = isCurrentlyRunning(campaign)

  const COST_PER_ABSCHLUSS_TARGET = 50
  let roiStatus: 'good' | 'warn' | 'bad' | 'none' = 'none'
  let roiText = '-'
  let RoiIcon: any = null
  if (budget > 0 && closed > 0) {
    const cpa = budget / closed
    const ratio = COST_PER_ABSCHLUSS_TARGET / Math.max(1, cpa)
    if (ratio >= 1.3) {
      roiStatus = 'good'
      roiText = `+${Math.round((ratio - 1) * 100)}% ROI`
      RoiIcon = TrendingUp
    } else if (ratio >= 0.7) {
      roiStatus = 'warn'
      roiText = `Ø ${cpa.toFixed(0)}€`
      RoiIcon = Minus
    } else {
      roiStatus = 'bad'
      roiText = `${Math.round((ratio - 1) * 100)}% ROI`
      RoiIcon = TrendingDown
    }
  } else if (total > 0 && closed === 0 && budget > 0) {
    roiStatus = 'warn'
    roiText = `0 Abschl.`
    RoiIcon = Minus
  }

  return (
    <tr className="hover:bg-slate-50 transition">
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <Link href={`/admin/campaigns/${campaign.id}`} className="inline-flex items-center gap-1.5 group">
            <span className="text-sm font-medium text-slate-900 group-hover:text-emerald-700 transition">
              {campaign.name}
            </span>
            {roiStatus !== 'none' && RoiIcon && (
              <span className={cn(
                'inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold shadow-sm',
                roiStatus === 'good' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                roiStatus === 'warn' && 'bg-amber-50 text-amber-700 border-amber-200',
                roiStatus === 'bad' && 'bg-red-50 text-red-700 border-red-200',
              )}>
                <RoiIcon className="h-2.5 w-2.5" />
                {roiText}
              </span>
            )}
          </Link>
          <span className="text-[11px] text-slate-500">
            {formatDateShort(campaign.start_date)}
            {campaign.start_date || campaign.end_date ? ' → ' : ''}
            {formatDateShort(campaign.end_date)}
            {campaign.external_id ? ` · Ext ${String(campaign.external_id).slice(0, 10)}` : ''}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-slate-700">
          {campaign.source ? (
            SOURCE_LABELS[campaign.source as keyof typeof SOURCE_LABELS] ?? String(campaign.source)
          ) : '-'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1">
          {running ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 border bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm">
              <PlayCircle className="h-3 w-3 fill-emerald-600/20" />
              Laufend
            </span>
          ) : campaign.is_active ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 border bg-amber-50 text-amber-700 border-amber-200">
              <CalendarClock className="h-3 w-3" />
              Aktiv
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2 py-0.5 border bg-slate-100 text-slate-500 border-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              Inaktiv
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end gap-1.5 min-w-[120px]">
          <span className="text-sm tabular-nums text-slate-900 font-medium">
            {campaign.budget_amount ? `${formatCurrency(budget)} €` : '-'}
          </span>
          {budget > 0 && (
            <div className="w-full max-w-[120px]">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    budgetPct >= 0.95 ? 'bg-red-500' : budgetPct >= 0.7 ? 'bg-amber-500' : 'bg-emerald-500',
                  )}
                  style={{ width: `${Math.max(budgetPct * 100, budgetPct > 0 ? 2 : 0)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 tabular-nums text-right">
                {usedBudget} / {budget} · {formatPercent(budgetPct)}
              </div>
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right hidden md:table-cell">
        <span className="text-sm tabular-nums font-medium text-slate-900">{total}</span>
        <div className="text-[10px] text-slate-500 tabular-nums">
          {assignedCount} zugewiesen
        </div>
      </td>
      <td className="px-4 py-3 text-right hidden lg:table-cell">
        <span className="text-sm tabular-nums font-medium text-emerald-700">{closed}</span>
        <div className="text-[10px] text-slate-500 tabular-nums">
          {stats.offer ?? 0} Angebot
        </div>
      </td>
      <td className="px-4 py-3 text-right hidden xl:table-cell">
        <span className={cn(
          'text-sm font-medium tabular-nums',
          quote >= 0.2 ? 'text-emerald-700' : quote >= 0.1 ? 'text-amber-700' : 'text-slate-500',
        )}>
          {formatPercent(quote)}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1.5 justify-end">
          <Link
            href={`/admin/campaigns/${campaign.id}`}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition"
          >
            <Sparkles className="h-3 w-3" />
            Analyse
          </Link>
          <EditCampaignDialog campaign={campaign as any}>
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer">
              <Pencil className="h-3 w-3" />
              Bearb.
            </span>
          </EditCampaignDialog>
        </div>
      </td>
    </tr>
  )
}
