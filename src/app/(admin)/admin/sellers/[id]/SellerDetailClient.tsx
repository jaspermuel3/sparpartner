'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatCard } from '@/components/ui-custom/StatCard'
import { TargetProgressBar } from '@/components/ui-custom/TargetProgressBar'
import {
  TokenDialog,
  ToggleActiveButton,
  EditSellerDialog,
  ResetPwdDialog,
} from '../AdminSellerDialogs'
import {
  Coins,
  UserCheck,
  XCircle,
  Award,
  Users,
  PhoneCall,
  ArrowUpRight,
  FileText,
  UserPlus,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { formatPercent } from '@/lib/constants'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface SellerDetailClientProps {
  seller: any
  teams: any[]
  targets: any[]
  perf: any
  leads: any[]
  audits: any[]
}

export function SellerDetailClient({
  seller,
  teams,
  targets,
  perf,
  leads,
  audits,
}: SellerDetailClientProps) {
  const sellerName = seller.full_name ?? seller.email ?? 'Verkäufer'
  const team = seller.team ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        title={sellerName}
        description={seller.email}
        breadcrumb={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Verkäufer', href: '/admin/sellers' },
          { label: sellerName },
        ]}
        actions={
          <>
            <TokenDialog seller={seller} mode="add" />
            <TokenDialog seller={seller} mode="subtract" />
            <ToggleActiveButton seller={seller} />
            <EditSellerDialog seller={seller} teams={teams} />
            <ResetPwdDialog seller={seller} />
          </>
        }
      />

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-xl font-semibold text-white shadow-sm">
                {sellerName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                    {sellerName}
                  </h2>
                  {seller.is_active ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5" />
                      Aktiv
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 mr-1.5" />
                      Deaktiviert
                    </Badge>
                  )}
                  {team && (
                    <Badge variant="outline" className="bg-white text-slate-700">
                      {team.color && (
                        <span
                          className="h-1.5 w-1.5 rounded-full mr-1.5"
                          style={{ backgroundColor: team.color }}
                        />
                      )}
                      {team.name}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 text-sm text-slate-500">{seller.email}</div>
                <div className="mt-0.5 text-xs text-slate-400 capitalize">
                  Rolle: {seller.role === 'admin' ? 'Administrator' : 'Verkäufer'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-amber-600" />
                  <span className="text-xs font-medium text-amber-800">Token-Guthaben</span>
                </div>
                <div className="mt-0.5 text-2xl font-semibold tracking-tight text-amber-900 tabular-nums">
                  {seller.wallet?.balance ?? 0}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="activity">
            Aktivitäten{' '}
            <span className="ml-1 text-[10px] text-slate-400">({audits.length})</span>
          </TabsTrigger>
          <TabsTrigger value="leads">
            Leads{' '}
            <span className="ml-1 text-[10px] text-slate-400">({leads.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="mt-5 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Zugewiesene Leads"
              value={perf.leads_total}
              icon={<Users className="h-4 w-4" />}
              accent="brand"
              hint="insgesamt"
            />
            <StatCard
              label="Abschlüsse"
              value={perf.abschlüsse}
              icon={<CheckCircle2 className="h-4 w-4" />}
              accent="success"
            />
            <StatCard
              label="Verlorene Leads"
              value={perf.verloren}
              icon={<XCircle className="h-4 w-4" />}
              accent="danger"
            />
            <StatCard
              label="Abschlussquote"
              value={formatPercent(perf.abschluss_quote)}
              icon={<Award className="h-4 w-4" />}
              accent="warning"
              hint={`Ø Kontakte: ${(perf.durchschnitt_kontakte ?? 0).toFixed(1)}`}
            />
          </div>

          <TargetProgressBar
            label="Monatliches Abschluss-Ziel"
            current={perf.abschlüsse}
            target={Math.max(perf.abschlüsse, 10)}
            type="abschluesse"
          />

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-slate-400" />
                6-Monate-Übersicht (mock)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={targets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="monat" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Leads" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Abschlüsse" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4 sm:grid-cols-3 lg:grid-cols-6">
                {targets.map((m: any, idx: number) => (
                  <div
                    key={m.monat}
                    className="rounded-lg border border-slate-200 bg-slate-50/50 p-3"
                  >
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {m.monat}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                      {m.Leads} <span className="text-xs font-normal text-slate-400">Leads</span>
                    </div>
                    <div className="text-xs font-medium text-emerald-700 tabular-nums">
                      {m.Abschlüsse} Abschlüsse
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-5">
          <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Zeitpunkt</TableHead>
                    <TableHead>Aktion</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Ressource-ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audits.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <div className="py-10 text-center text-sm text-slate-500">
                          <FileText className="h-5 w-5 mx-auto mb-2 text-slate-400" />
                          Noch keine Aktivitäten vorhanden.
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {audits.map((a: any) => (
                    <TableRow key={a.id} className="hover:bg-slate-50">
                      <TableCell className="whitespace-nowrap text-xs text-slate-600 tabular-nums">
                        {a.created_at
                          ? new Date(a.created_at).toLocaleString('de-DE', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <AuditBadge action={a.action} />
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {a.resource_type ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-slate-500">
                        {a.resource_id ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="mt-5">
          <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead className="hidden md:table-cell">Produkt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Erstellt</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="py-10 text-center text-sm text-slate-500">
                          <UserPlus className="h-5 w-5 mx-auto mb-2 text-slate-400" />
                          Diesem Verkäufer sind noch keine Leads zugewiesen.
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {leads.map((l: any) => (
                    <TableRow key={l.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="font-medium text-slate-900">
                          {l.first_name} {l.last_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {l.phone ?? l.email ?? '—'}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell capitalize text-sm text-slate-700">
                        {l.product ?? '—'}
                      </TableCell>
                      <TableCell>
                        <span className="capitalize text-xs font-medium text-slate-700">
                          {mapLeadStatus(l.status)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-slate-500 tabular-nums">
                        {l.created_at
                          ? new Date(l.created_at).toLocaleDateString('de-DE')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/leads/${l.id}`}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Öffnen <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AuditBadge({ action }: { action: string }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    LEAD_ASSIGNED: {
      label: 'Lead zugewiesen',
      cls: 'bg-blue-50 border-blue-200 text-blue-700',
      icon: Users,
    },
    LEAD_CREATED: {
      label: 'Lead erstellt',
      cls: 'bg-indigo-50 border-indigo-200 text-indigo-700',
      icon: UserPlus,
    },
    LEAD_RESET: {
      label: 'Lead zurückgesetzt',
      cls: 'bg-slate-50 border-slate-200 text-slate-700',
      icon: Minus,
    },
    LEAD_HOLD_UPDATED: {
      label: 'Lead Hold',
      cls: 'bg-amber-50 border-amber-200 text-amber-700',
      icon: Minus,
    },
    TAG_ASSIGNED: {
      label: 'Tag zugewiesen',
      cls: 'bg-purple-50 border-purple-200 text-purple-700',
      icon: Award,
    },
    DOCUMENT_UPLOADED: {
      label: 'Dokument hochgeladen',
      cls: 'bg-sky-50 border-sky-200 text-sky-700',
      icon: FileText,
    },
    SELLER_CREATED: {
      label: 'Verkäufer erstellt',
      cls: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      icon: UserCheck,
    },
    SELLER_UPDATED: {
      label: 'Verkäufer bearbeitet',
      cls: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      icon: UserCheck,
    },
    SELLER_ACTIVATED: {
      label: 'Verkäufer aktiviert',
      cls: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      icon: CheckCircle2,
    },
    SELLER_DEACTIVATED: {
      label: 'Verkäufer deaktiviert',
      cls: 'bg-red-50 border-red-200 text-red-700',
      icon: XCircle,
    },
    TOKEN_CREDIT: {
      label: 'Tokens gutgeschrieben',
      cls: 'bg-amber-50 border-amber-200 text-amber-700',
      icon: TrendingUp,
    },
    TOKEN_DEBIT: {
      label: 'Tokens abgebucht',
      cls: 'bg-amber-50 border-amber-200 text-amber-700',
      icon: TrendingDown,
    },
    ADMIN_CHANGE: {
      label: 'Admin-Änderung',
      cls: 'bg-slate-50 border-slate-200 text-slate-700',
      icon: FileText,
    },
  }
  const m = map[action ?? ''] ?? {
    label: action ?? 'Unbekannt',
    cls: 'bg-slate-50 border-slate-200 text-slate-700',
    icon: FileText,
  }
  const Icon = m.icon
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ' +
        m.cls
      }
    >
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  )
}

function mapLeadStatus(status: string) {
  switch (status) {
    case 'new':
      return 'Neu'
    case 'contacted':
      return 'Kontaktiert'
    case 'callback':
      return 'Rückruf'
    case 'offer':
      return 'Angebot'
    case 'closed':
      return 'Abgeschlossen'
    case 'no_interest':
      return 'Kein Interesse'
    case 'wrong_data':
      return 'Falsche Daten'
    case 'canceled':
      return 'Abgebrochen'
    default:
      return status ?? '—'
  }
}
