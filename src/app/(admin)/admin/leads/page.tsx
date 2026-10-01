import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import {
  adminGetAllLeads,
  getAllSellers,
  getAllCampaigns,
} from '@/lib/services/admin.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { LeadStatusBadge } from '@/components/ui-custom/StatusBadges'
import { PhoneLink } from '@/components/ui-custom/PhoneLink'
import { AssignLeadDialog, ResetLeadDialog, CreateLeadDialog, HoldLeadDialog } from './AdminLeadDialogs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Layers, ChevronLeft, ChevronRight, Filter, X, Snowflake } from 'lucide-react'
import {
  LEAD_STATUS_LABELS,
  PRODUCT_LABELS,
  formatDate,
  formatPhone,
  formatDaysSince,
  leadAgeClass,
  SOURCE_LABELS,
} from '@/lib/constants'
import type { LeadStatus } from '@/types'
import { buildQueryString, cn } from '@/lib/utils'
import { AdminLeadFilterClient } from './AdminLeadFilterClient'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export const metadata = { title: 'Leads · Admin' }

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: {
    q?: string
    status?: string
    availability?: 'available' | 'assigned'
    seller?: string
    from?: string
    to?: string
    hold?: string
    page?: string
  }
}) {
  await requireAdmin()
  const q = searchParams.q ?? ''
  const statuses = searchParams.status
    ? (searchParams.status.split(',').filter(Boolean) as LeadStatus[])
    : []
  const availability = (searchParams.availability as any) ?? undefined
  const sellerId = searchParams.seller || undefined
  const holdRaw = searchParams.hold ?? ''
  const page = Number(searchParams.page ?? '1') || 1
  const sellers = (await getAllSellers()) as any[] ?? []
  const campaigns = (await getAllCampaigns()) as any[] ?? []

  const isOnHoldFilter: boolean | undefined =
    holdRaw === 'on' ? true : holdRaw === 'off' ? false : undefined

  const res = await adminGetAllLeads({
    search: q || undefined,
    statuses: statuses.length > 0 ? statuses : undefined,
    availability,
    sellerId,
    from: searchParams.from || undefined,
    to: searchParams.to || undefined,
    isOnHold: isOnHoldFilter,
    page,
    pageSize: 25,
  })

  const totalPages = Math.max(1, Math.ceil(res.count / 25))
  const statusList: LeadStatus[] = [
    'new',
    'assigned',
    'contacted',
    'callback',
    'offer',
    'closed',
    'no_interest',
    'wrong_data',
    'canceled',
  ]

  const statusFilter = statuses
  const hasFilter = Boolean(
    q || statusFilter.length > 0 || availability || sellerId || searchParams.from || searchParams.to || holdRaw,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Leads', href: '/admin/leads' },
        ]}
        title="Leads verwalten"
        description={`${res.count} Leads im System. Alle Verkäufer und unvergebene Leads im Überblick.`}
        actions={<CreateLeadDialog campaigns={campaigns} sellers={sellers} />}
      />

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <form action="/admin/leads" method="get" className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
              <div className="relative md:col-span-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  name="q"
                  defaultValue={q}
                  placeholder="Suche: Name, Telefon, E-Mail, Lead-ID…"
                  className="pl-9"
                />
              </div>
              <AdminLeadFilterClient
                statuses={statusList}
                sellers={sellers}
                initialStatus={searchParams.status ?? 'all'}
                initialAvailability={availability ?? 'all'}
                initialSeller={sellerId ?? 'all'}
              />
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Hold</label>
                <select
                  name="hold"
                  defaultValue={holdRaw}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="">Alle</option>
                  <option value="off">Aktiv (nicht auf Eis)</option>
                  <option value="on">Auf Eis gelegt</option>
                </select>
              </div>
              <div className="md:col-span-3 flex items-end gap-2">
                <Input type="date" name="from" defaultValue={searchParams.from} className="w-auto" />
                <span className="text-slate-400 text-sm">bis</span>
                <Input type="date" name="to" defaultValue={searchParams.to} className="w-auto" />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <div className="text-xs text-slate-500">
                {hasFilter ? (
                  <Link
                    href="/admin/leads"
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 hover:underline"
                  >
                    <X className="h-3 w-3" /> Filter zurücksetzen
                  </Link>
                ) : <span>&nbsp;</span>}
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" variant="default">
                  <Filter className="h-3.5 w-3.5" /> Filtern
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Produkt</TableHead>
                <TableHead>Quelle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Alter</TableHead>
                <TableHead className="hidden lg:table-cell">Verkäufer</TableHead>
                <TableHead className="hidden xl:table-cell">Erstellt</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {res.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center m-4">
                      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div className="text-sm font-medium text-slate-800">Keine Leads gefunden</div>
                      <div className="mt-1 text-xs text-slate-500 max-w-xs">
                        Passe Filter an oder lege neue Leads an.
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {(res.data as any[]).map((lead) => {
                const ageDays = formatDaysSince(lead.created_at)
                return (
                  <TableRow key={lead.id} className={cn('group hover:bg-slate-50', lead.is_on_hold && 'opacity-70')}>
                    <TableCell>
                      <Link href={`/leads/${lead.id}`} className="block">
                        <div className="flex items-start gap-2">
                          {lead.is_on_hold && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="mt-0.5 inline-flex items-center text-sky-600">
                                  <Snowflake className="h-3.5 w-3.5" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                <div className="text-xs">
                                  <div className="font-medium text-slate-900">Auf Eis gelegt</div>
                                  {lead.hold_notes && (
                                    <div className="text-slate-600 mt-1 max-w-xs whitespace-pre-wrap">{lead.hold_notes}</div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 group-hover:text-slate-950">
                              {lead.first_name} {lead.last_name}
                            </div>
                            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2">
                              <PhoneLink phone={lead.phone}>
                                {formatPhone(lead.phone)}
                              </PhoneLink>
                              {lead.email && (
                                <span className="truncate max-w-[160px]">{lead.email}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-700">{PRODUCT_LABELS[lead.product as keyof typeof PRODUCT_LABELS]}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-500">
                        {SOURCE_LABELS[lead.source as keyof typeof SOURCE_LABELS]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <LeadStatusBadge status={lead.status} />
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className={cn('text-sm font-medium tabular-nums', leadAgeClass(ageDays))}>
                        {ageDays === null ? '-' : `${ageDays} Tage`}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {lead.assigned_user ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                            {(lead.assigned_user.full_name ?? '?').slice(0, 1).toUpperCase()}
                          </div>
                          {lead.assigned_user.full_name ?? lead.assigned_user.email}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Verfügbar</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-xs text-slate-500">
                      {formatDate(lead.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/leads/${lead.id}`}>Öffnen</Link>
                        </Button>
                        <HoldLeadDialog leadId={lead.id} isOnHold={lead.is_on_hold} currentNotes={lead.hold_notes} />
                        {!lead.assigned_user_id ? (
                          <AssignLeadDialog leadId={lead.id} sellers={sellers} />
                        ) : (
                          <ResetLeadDialog leadId={lead.id} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TooltipProvider>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
            <div className="text-xs text-slate-500">
              Seite {page} / {totalPages} · {res.count} Leads
            </div>
            <div className="flex items-center gap-1">
              {page > 1 ? (
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/admin/leads${buildQueryString(searchParams, { page: page - 1 })}`}>
                    <ChevronLeft className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="ghost" disabled>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="px-2 text-xs font-medium text-slate-600">
                {page} / {totalPages}
              </div>
              {page < totalPages ? (
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/admin/leads${buildQueryString(searchParams, { page: page + 1 })}`}>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="ghost" disabled>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
