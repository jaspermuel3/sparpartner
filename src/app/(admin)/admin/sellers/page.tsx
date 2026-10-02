import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { getAllSellers, getSellerPerformance } from '@/lib/services/admin.service'
import { getAllTeams } from '@/lib/services/teams.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  CreateSellerDialog,
  TokenDialog,
  ToggleActiveButton,
  EditSellerDialog,
  ResetPwdDialog,
  BulkTokenButton,
  DeleteSellerDialog,
  RestoreSellerDialog,
  BulkDeactivateButton,
} from './AdminSellerDialogs'
import {
  UserPlus,
  Coins,
  CheckCircle2,
  Search,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Clock,
  Trash2,
  Undo2,
} from 'lucide-react'
import { formatPercent } from '@/lib/constants'
import { buildQueryString, cn } from '@/lib/utils'

export const metadata = { title: 'Benutzer · Admin' }

type SortKey =
  | 'name'
  | 'email'
  | 'role'
  | 'is_active'
  | 'team_name'
  | 'tokens'
  | 'leads'
  | 'abschlüsse'
  | 'quote'
  | 'kontakte'

const SORT_KEY_TO_FIELD: Record<SortKey, string> = {
  name: 'full_name',
  email: 'email',
  role: 'role',
  is_active: 'is_active',
  team_name: 'team_name',
  tokens: 'tokens',
  leads: 'leads',
  abschlüsse: 'abschlüsse',
  quote: 'quote',
  kontakte: 'kontakte',
}

export default async function AdminSellersPage({
  searchParams,
}: {
  searchParams: {
    q?: string
    team?: string
    role?: string
    status?: string
    sortBy?: SortKey
    sortDir?: 'asc' | 'desc'
  }
}) {
  await requireAdmin()
  const [sellersRaw, teams] = await Promise.all([
    getAllSellers() as Promise<any[]>,
    getAllTeams() as Promise<any[]>,
  ])

  const teamMap: Record<string, any> = {}
  for (const t of teams) teamMap[t.id] = t

  const sellersWithPerf = await Promise.all(
    sellersRaw.map(async (s) => {
      const p = await getSellerPerformance(s.id)
      const team = s.team_id ? teamMap[s.team_id] : null
      return {
        ...s,
        perf: p,
        team_name: team?.name ?? null,
        team_color: team?.color ?? null,
      }
    }),
  )

  let rows = [...sellersWithPerf]

  const q = (searchParams.q ?? '').trim().toLowerCase()
  if (q) {
    rows = rows.filter(
      (s) =>
        (s.full_name ?? '').toLowerCase().includes(q) ||
        (s.email ?? '').toLowerCase().includes(q),
    )
  }

  const teamFilter = searchParams.team
  if (teamFilter) {
    if (teamFilter === '__none__') {
      rows = rows.filter((s) => !s.team_id)
    } else {
      rows = rows.filter((s) => String(s.team_id) === String(teamFilter))
    }
  }

  const roleFilter = searchParams.role
  if (roleFilter) {
    rows = rows.filter((s) => s.role === roleFilter)
  }

  const statusFilter = searchParams.status
  if (statusFilter) {
    switch (statusFilter) {
      case 'active':
        rows = rows.filter((s) => s.is_active && !s.is_deleted)
        break
      case 'inactive':
        rows = rows.filter((s) => !s.is_active && !s.is_deleted)
        break
      case 'deleted':
        rows = rows.filter((s) => !!s.is_deleted)
        break
      case 'all':
        break
    }
  } else {
    // Default: gelöschte ausblenden
    rows = rows.filter((s) => !s.is_deleted)
  }

  const sortBy: SortKey = searchParams.sortBy ?? 'name'
  const sortDir: 'asc' | 'desc' = searchParams.sortDir ?? 'asc'
  const field = SORT_KEY_TO_FIELD[sortBy] ?? 'full_name'
  rows.sort((a: any, b: any) => {
    let av: any = 0
    let bv: any = 0
    switch (field) {
      case 'full_name':
        av = (a.full_name ?? a.email ?? '').toString().toLowerCase()
        bv = (b.full_name ?? b.email ?? '').toString().toLowerCase()
        break
      case 'email':
        av = (a.email ?? '').toString().toLowerCase()
        bv = (b.email ?? '').toString().toLowerCase()
        break
      case 'role':
        av = (a.role ?? '').toString().toLowerCase()
        bv = (b.role ?? '').toString().toLowerCase()
        break
      case 'is_active':
        av = a.is_active ? 1 : 0
        bv = b.is_active ? 1 : 0
        break
      case 'team_name':
        av = (a.team_name ?? '').toString().toLowerCase()
        bv = (b.team_name ?? '').toString().toLowerCase()
        break
      case 'tokens':
        av = Number(a.wallet?.balance ?? 0)
        bv = Number(b.wallet?.balance ?? 0)
        break
      case 'leads':
        av = Number(a.perf?.leads_total ?? 0)
        bv = Number(b.perf?.leads_total ?? 0)
        break
      case 'abschlüsse':
        av = Number(a.perf?.abschlüsse ?? 0)
        bv = Number(b.perf?.abschlüsse ?? 0)
        break
      case 'quote':
        av = Number(a.perf?.abschluss_quote ?? 0)
        bv = Number(b.perf?.abschluss_quote ?? 0)
        break
      case 'kontakte':
        av = Number(a.perf?.durchschnitt_kontakte ?? 0)
        bv = Number(b.perf?.durchschnitt_kontakte ?? 0)
        break
      default:
        av = 0
        bv = 0
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const totalCount = sellersWithPerf.length
  const activeCount = sellersWithPerf.filter((s) => s.is_active && !s.is_deleted).length
  const deletedCount = sellersWithPerf.filter((s) => !!s.is_deleted).length
  const shownCount = rows.length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Benutzer verwalten"
        description={`${totalCount} Konten · ${activeCount} aktiv · ${deletedCount} gelöscht · ${shownCount} angezeigt`}
        breadcrumb={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Benutzer', href: '/admin/sellers' },
        ]}
        actions={
          <>
            <BulkDeactivateButton disabled={rows.length === 0} />
            <BulkTokenButton disabled={rows.length === 0} />
            <CreateSellerDialog teams={teams} />
          </>
        }
      />

      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 p-4 space-y-3">
          <form
            method="GET"
            action="/admin/sellers"
            className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto_auto_auto] items-end"
          >
            <input type="hidden" name="sortBy" value={sortBy} />
            <input type="hidden" name="sortDir" value={sortDir} />
            <div className="space-y-1.5">
              <label htmlFor="q" className="text-xs font-medium text-slate-600">
                Suche nach Name / E-Mail
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="q"
                  name="q"
                  defaultValue={searchParams.q ?? ''}
                  placeholder="z. B. Max Mustermann oder max@unternehmen.de"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5 min-w-[140px]">
              <label htmlFor="status" className="text-xs font-medium text-slate-600">Status</label>
              <select
                id="status"
                name="status"
                defaultValue={searchParams.status ?? ''}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Aktiv & Inaktiv</option>
                <option value="active">Nur Aktiv</option>
                <option value="inactive">Nur Inaktiv</option>
                <option value="deleted">Gelöschte</option>
                <option value="all">Alle inkl. Gelöschte</option>
              </select>
            </div>
            <div className="space-y-1.5 min-w-[140px]">
              <label htmlFor="role" className="text-xs font-medium text-slate-600">Rolle</label>
              <select
                id="role"
                name="role"
                defaultValue={searchParams.role ?? ''}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Alle Rollen</option>
                <option value="admin">Admin</option>
                <option value="seller">Verkäufer</option>
              </select>
            </div>
            <div className="space-y-1.5 min-w-[180px]">
              <label htmlFor="team" className="text-xs font-medium text-slate-600">Team</label>
              <select
                id="team"
                name="team"
                defaultValue={searchParams.team ?? ''}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Alle Teams</option>
                <option value="__none__">Ohne Team</option>
                {teams.map((t: any) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Link
                href="/admin/sellers"
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                Zurücksetzen
              </Link>
              <Button type="submit">
                <Search className="h-4 w-4 mr-1.5" /> Suchen
              </Button>
            </div>
          </form>
        </div>

        <div id="sellers-table-form">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[44px]">
                    <label className="flex items-center justify-center h-5 cursor-pointer">
                      <input
                        type="checkbox"
                        id="masterToggleSellers"
                        className="cursor-pointer"
                      />
                    </label>
                    <div className="text-center text-[11px] font-medium text-slate-500 mt-1">
                      Alle
                    </div>
                  </TableHead>
                  <SortableHead label="Benutzer" sortKey="name" currentSortBy={sortBy} currentSortDir={sortDir} searchParams={searchParams} />
                  <SortableHead label="Rolle" sortKey="role" currentSortBy={sortBy} currentSortDir={sortDir} searchParams={searchParams} />
                  <SortableHead label="Status" sortKey="is_active" currentSortBy={sortBy} currentSortDir={sortDir} searchParams={searchParams} />
                  <SortableHead label="Team" sortKey="team_name" currentSortBy={sortBy} currentSortDir={sortDir} searchParams={searchParams} />
                  <SortableHead label="Letzter Login" hidden="md" currentSortBy={sortBy} currentSortDir={sortDir} searchParams={searchParams} sortKey="name" />
                  <SortableHead label="Tokens" align="right" sortKey="tokens" currentSortBy={sortBy} currentSortDir={sortDir} searchParams={searchParams} />
                  <SortableHead label="Leads" align="right" hidden="md" sortKey="leads" currentSortBy={sortBy} currentSortDir={sortDir} searchParams={searchParams} />
                  <SortableHead label="Abschlüsse" align="right" hidden="lg" sortKey="abschlüsse" currentSortBy={sortBy} currentSortDir={sortDir} searchParams={searchParams} />
                  <SortableHead label="Quote" align="right" hidden="xl" sortKey="quote" currentSortBy={sortBy} currentSortDir={sortDir} searchParams={searchParams} />
                  <SortableHead label="Ø Kontakte" align="right" hidden="xl" sortKey="kontakte" currentSortBy={sortBy} currentSortDir={sortDir} searchParams={searchParams} />
                  <TableHead className="text-right w-[210px]">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12}>
                      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center m-4">
                        <div className="mb-2 text-slate-400">
                          <UserPlus className="h-5 w-5" />
                        </div>
                        <div className="text-sm font-medium text-slate-800">
                          Keine Benutzer gefunden
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Passe Filter an oder erstelle einen neuen Benutzer.
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((s) => (
                  <SellerRow key={s.id} seller={s} teams={teams} />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>

      <script
        dangerouslySetInnerHTML={{
          __html: `
(function() {
  function updateBulkSelected() {
    const checks = document.querySelectorAll('input.toggle-seller[type="checkbox"]');
    const ids = [];
    checks.forEach((c) => { if (c.checked) ids.push(c.getAttribute('data-user-id')); });
    const hidden = document.getElementById('bulkSelectedIds');
    if (hidden) hidden.value = ids.join(',');
    const hidden2 = document.getElementById('bulkSelectedIdsDeactivate');
    if (hidden2) hidden2.value = ids.join(',');
    const master = document.getElementById('masterToggleSellers');
    if (master && checks.length > 0) {
      const allChecked = Array.from(checks).every((c) => c.checked);
      master.checked = allChecked;
    }
    const btnToken = document.querySelector('[data-bulk-token-btn]');
    if (btnToken) btnToken.disabled = ids.length === 0;
    const btnDeact = document.querySelector('[data-bulk-deactivate-btn]');
    if (btnDeact) btnDeact.disabled = ids.length === 0;
  }
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t && t.classList && t.classList.contains('toggle-seller')) {
      updateBulkSelected();
    }
    if (t && t.id === 'masterToggleSellers') {
      const checks = document.querySelectorAll('input.toggle-seller[type="checkbox"]');
      checks.forEach((c) => { c.checked = t.checked; });
      updateBulkSelected();
    }
  });
  document.addEventListener('DOMContentLoaded', updateBulkSelected);
})();
          `,
        }}
      />
    </div>
  )
}

function SortableHead({
  label,
  sortKey,
  currentSortBy,
  currentSortDir,
  searchParams,
  align = 'left',
  hidden,
}: {
  label: string
  sortKey: SortKey
  currentSortBy: SortKey
  currentSortDir: 'asc' | 'desc'
  searchParams: { q?: string; team?: string; role?: string; status?: string }
  align?: 'left' | 'right'
  hidden?: 'md' | 'lg' | 'xl'
}) {
  const isActive = currentSortBy === sortKey
  const nextDir: 'asc' | 'desc' = isActive && currentSortDir === 'asc' ? 'desc' : 'asc'
  const href = `/admin/sellers${buildQueryString(searchParams, {
    sortBy: sortKey,
    sortDir: nextDir,
  })}`
  return (
    <TableHead
      className={cn(
        align === 'right' && 'text-right',
        hidden === 'md' && 'hidden md:table-cell',
        hidden === 'lg' && 'hidden lg:table-cell',
        hidden === 'xl' && 'hidden xl:table-cell',
      )}
    >
      <Link
        href={href}
        className={cn(
          'inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide hover:text-slate-900',
          align === 'right' ? 'justify-end w-full' : '',
          isActive ? 'text-slate-900' : 'text-slate-500',
        )}
      >
        {label}
        {isActive ? (
          currentSortDir === 'asc' ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronUp className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
        )}
      </Link>
    </TableHead>
  )
}

function formatRelativeOrNever(iso: string | null | undefined): string {
  if (!iso) return 'Nie'
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return 'Nie'
  const diffSec = Math.max(0, Math.floor((Date.now() - d) / 1000))
  if (diffSec < 60) return 'Gerade eben'
  if (diffSec < 3600) return `vor ${Math.floor(diffSec / 60)} Min.`
  if (diffSec < 86400) return `vor ${Math.floor(diffSec / 3600)} Std.`
  if (diffSec < 30 * 86400) return `vor ${Math.floor(diffSec / 86400)} Tg.`
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function SellerRow({ seller, teams }: { seller: any; teams: any[] }) {
  const p = seller.perf ?? {}
  const isAdmin = seller.role === 'admin'
  const isDeleted = !!seller.is_deleted
  return (
    <TableRow
      className={cn(
        'hover:bg-slate-50/80 group transition-colors',
        isDeleted && 'bg-rose-50/20',
      )}
    >
      <TableCell className="w-[44px]">
        <label className="flex items-center justify-center h-5 cursor-pointer">
          <input
            type="checkbox"
            className="toggle-seller cursor-pointer"
            data-user-id={seller.id}
          />
        </label>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white',
              isDeleted
                ? 'bg-gradient-to-br from-rose-600 to-rose-800'
                : 'bg-gradient-to-br from-slate-700 to-slate-900',
            )}
          >
            {(seller.full_name ?? seller.email ?? '?').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <Link
                href={`/admin/sellers/${seller.id}`}
                className={cn(
                  'font-medium hover:text-indigo-600 inline-flex items-center gap-1',
                  isDeleted ? 'text-rose-800 line-through decoration-rose-300' : 'text-slate-900',
                )}
              >
                {seller.full_name ?? 'Kein Name'}
                <ExternalLink className="h-3 w-3 text-slate-400 opacity-50" />
              </Link>
              {isDeleted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                  <Trash2 className="h-2.5 w-2.5" /> Gelöscht
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500">{seller.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {isAdmin ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
            Admin
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
            Verkäufer
          </span>
        )}
      </TableCell>
      <TableCell>
        {isDeleted ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[11px] font-medium text-rose-700">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Gelöscht
          </span>
        ) : seller.is_active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Aktiv
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Deaktiviert
          </span>
        )}
      </TableCell>
      <TableCell>
        {seller.team_name ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700"
          >
            {seller.team_color && (
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: seller.team_color }}
              />
            )}
            {seller.team_name}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400">—</span>
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="h-3 w-3 text-slate-400" />
          <span title={seller.last_login_at ? new Date(seller.last_login_at).toLocaleString('de-DE') : 'Nie angemeldet'}>
            {formatRelativeOrNever(seller.last_login_at)}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800">
          <Coins className="h-4 w-4 text-amber-500" />
          {seller.wallet?.balance ?? 0}
        </span>
      </TableCell>
      <TableCell className="hidden md:table-cell text-right text-sm text-slate-700 tabular-nums">
        {p.leads_total ?? 0}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-right">
        <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {p.abschlüsse ?? 0}
        </span>
      </TableCell>
      <TableCell className="hidden xl:table-cell text-right">
        <span
          className={
            'text-sm font-medium ' +
            ((p.abschluss_quote ?? 0) >= 0.3
              ? 'text-emerald-700'
              : (p.abschluss_quote ?? 0) >= 0.1
                ? 'text-amber-700'
                : 'text-slate-500')
          }
        >
          {formatPercent(p.abschluss_quote ?? 0)}
        </span>
      </TableCell>
      <TableCell className="hidden xl:table-cell text-right text-sm text-slate-700 tabular-nums">
        {(p.durchschnitt_kontakte ?? 0).toFixed(1)}
      </TableCell>
      <TableCell className="text-right w-[210px]">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {isDeleted ? (
            <RestoreSellerDialog seller={seller} />
          ) : (
            <>
              <TokenDialog seller={seller} mode="add" />
              <TokenDialog seller={seller} mode="subtract" />
              <ToggleActiveButton seller={seller} />
              <EditSellerDialog seller={seller} teams={teams} />
              <ResetPwdDialog seller={seller} />
              <DeleteSellerDialog seller={seller} />
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
