import { requireAdmin } from '@/lib/auth'
import { getAuditLogsFiltered, getAllSellers } from '@/lib/services/admin.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ShieldCheck, UserCheck, Ban, Layers, CreditCard, PhoneCall, Filter, X } from 'lucide-react'
import { AUDIT_ACTION_LABELS, formatDate } from '@/lib/constants'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const ACTIONS = [
  'LEAD_ASSIGNED', 'LEAD_RESET', 'STATUS_CHANGED', 'TOKEN_DEBIT', 'TOKEN_CREDIT',
  'SELLER_CREATED', 'SELLER_UPDATED', 'SELLER_DEACTIVATED', 'SELLER_ACTIVATED',
  'ADMIN_CHANGE', 'CONTACT_ATTEMPT', 'CALLBACK_CREATED', 'CALLBACK_UPDATED',
  'LEAD_DELETED', 'LEAD_CANCEL_REQUEST', 'LEAD_CANCEL_APPROVED', 'LEAD_CANCEL_REJECTED',
] as const
const RESOURCE_TYPES = ['user', 'lead', 'token_wallet', 'campaign', 'notification', 'audit_log'] as const

export const metadata = { title: 'Audit-Log · Admin' }

const ICON_MAP: Record<string, any> = {
  LEAD_ASSIGNED: Layers,
  LEAD_RESET: Layers,
  STATUS_CHANGED: Layers,
  TOKEN_DEBIT: CreditCard,
  TOKEN_CREDIT: CreditCard,
  SELLER_CREATED: UserCheck,
  SELLER_UPDATED: UserCheck,
  SELLER_DEACTIVATED: Ban,
  SELLER_ACTIVATED: UserCheck,
  ADMIN_CHANGE: ShieldCheck,
  CONTACT_ATTEMPT: PhoneCall,
  CALLBACK_CREATED: PhoneCall,
  CALLBACK_UPDATED: PhoneCall,
  LEAD_DELETED: Ban,
  LEAD_CANCEL_REQUEST: ShieldCheck,
  LEAD_CANCEL_APPROVED: UserCheck,
  LEAD_CANCEL_REJECTED: Ban,
}

function ShieldOrFallback(key: string) {
  return ICON_MAP[key] ?? ShieldCheck
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: {
    action?: string
    user?: string
    resource_type?: string
    from?: string
    to?: string
    q?: string
  }
}) {
  await requireAdmin()
  const [sellers, result] = await Promise.all([
    getAllSellers(),
    getAuditLogsFiltered({
      actionType: searchParams.action,
      userId: searchParams.user,
      resourceType: searchParams.resource_type,
      from: searchParams.from,
      to: searchParams.to,
      search: searchParams.q,
      limit: 500,
    }),
  ])
  const logs = (result.rows as any[]) ?? []
  const hasFilter = Boolean(
    searchParams.action || searchParams.user || searchParams.resource_type ||
    searchParams.from || searchParams.to || searchParams.q,
  )

  const filterCount = [
    searchParams.action, searchParams.user, searchParams.resource_type,
    searchParams.from, searchParams.to, searchParams.q,
  ].filter(Boolean).length

  function removeFilter(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams as any)
    if (value) params.delete(key)
    else {
      // clear all
      return '/admin/audit-log'
    }
    const qs = params.toString()
    return qs ? `/admin/audit-log?${qs}` : '/admin/audit-log'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit-Log"
        description={`${result.count} Einträge · Alle Aktionen werden nachverfolgt.`}
      />

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <form
            method="GET"
            action="/admin/audit-log"
            className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end"
          >
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-medium text-slate-600 inline-flex items-center gap-1">
                <Filter className="h-3 w-3" /> Suche
              </label>
              <input
                type="search"
                name="q"
                defaultValue={searchParams.q ?? ''}
                placeholder="Ressourcen-ID, Details…"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Aktionstyp</label>
              <select
                name="action"
                defaultValue={searchParams.action ?? ''}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="">Alle Aktionen</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {AUDIT_ACTION_LABELS[a as keyof typeof AUDIT_ACTION_LABELS] ?? a}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Benutzer</label>
              <select
                name="user"
                defaultValue={searchParams.user ?? ''}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="">Alle Benutzer</option>
                {(sellers as any[]).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name ?? s.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Ressource</label>
              <select
                name="resource_type"
                defaultValue={searchParams.resource_type ?? ''}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="">Alle Ressourcen</option>
                {RESOURCE_TYPES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1 space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Von</label>
              <input
                type="date"
                name="from"
                defaultValue={searchParams.from}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div className="md:col-span-1 space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Bis</label>
              <input
                type="date"
                name="to"
                defaultValue={searchParams.to}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div className="md:col-span-12 flex items-center justify-between gap-2 flex-wrap pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                {searchParams.action && (
                  <FilterChip label={`Aktion: ${AUDIT_ACTION_LABELS[searchParams.action as keyof typeof AUDIT_ACTION_LABELS] ?? searchParams.action}`} href={removeFilter('action', searchParams.action)} />
                )}
                {searchParams.user && (
                  <FilterChip
                    label={`Benutzer: ${(sellers as any[]).find((s) => s.id === searchParams.user)?.full_name ?? searchParams.user.slice(0, 8)}`}
                    href={removeFilter('user', searchParams.user)}
                  />
                )}
                {searchParams.resource_type && (
                  <FilterChip label={`Ressource: ${searchParams.resource_type}`} href={removeFilter('resource_type', searchParams.resource_type)} />
                )}
                {searchParams.from && <FilterChip label={`Von: ${searchParams.from}`} href={removeFilter('from', searchParams.from)} />}
                {searchParams.to && <FilterChip label={`Bis: ${searchParams.to}`} href={removeFilter('to', searchParams.to)} />}
                {searchParams.q && <FilterChip label={`Suche: ${searchParams.q}`} href={removeFilter('q', searchParams.q)} />}
                {filterCount > 1 && (
                  <Link
                    href="/admin/audit-log"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <X className="h-3 w-3" /> Alle Filter entfernen ({filterCount})
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-2">
                {hasFilter && (
                  <span className="text-xs text-slate-500">
                    {logs.length} von {result.count} Treffern
                  </span>
                )}
                <button
                  type="submit"
                  className="h-10 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
                >
                  Filtern
                </button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardContent className="p-0 max-h-[80vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white/90 backdrop-blur">
              <TableRow>
                <TableHead className="w-40">Zeitpunkt</TableHead>
                <TableHead>Vorgang</TableHead>
                <TableHead>Benutzer</TableHead>
                <TableHead>Ressource</TableHead>
                <TableHead className="hidden md:table-cell">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center m-4">
                      <ShieldCheck className="h-6 w-6 text-slate-400 mb-2" />
                      <div className="text-sm font-medium text-slate-800">
                        {hasFilter ? 'Keine Treffer' : 'Noch keine Audit-Einträge'}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {hasFilter ? 'Probiere andere Filterkriterien.' : 'Alle Aktionen ab dem ersten Login werden hier sichtbar.'}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log) => {
                const actionKey = (log.action ?? '') as keyof typeof AUDIT_ACTION_LABELS
                const Icon = ShieldOrFallback(log.action)
                const label = AUDIT_ACTION_LABELS[actionKey] ?? log.action
                return (
                  <TableRow key={log.id} className="hover:bg-slate-50">
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">{formatDate(log.created_at)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 text-sm">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="font-medium text-slate-800">{label}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-800">{log.user?.full_name ?? 'System'}</div>
                      {log.user?.email && <div className="text-[11px] text-slate-500">{log.user.email}</div>}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        {log.resource_type}
                      </span>
                      {log.resource_id && (
                        <span className="ml-1 text-slate-400">#{log.resource_id.slice(0, 8)}</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <pre className="max-w-md truncate rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                          {JSON.stringify(log.details)}
                        </pre>
                      ) : (
                        <span className="text-xs text-slate-400">–</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function FilterChip({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
    >
      {label}
      <X className="h-3 w-3" />
    </Link>
  )
}
