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
import { cn } from '@/lib/utils'
import {
  TokenDialog,
  ToggleActiveButton,
  EditSellerDialog,
  ResetPwdDialog,
  DeleteSellerDialog,
  RestoreSellerDialog,
  MagicLinkDialog,
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
  Trash2,
  Undo2,
  LogIn,
  ShieldCheck,
  CalendarDays,
  Clock,
  Phone,
  Mail,
  AlertTriangle,
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
          { label: 'Benutzer', href: '/admin/sellers' },
          { label: sellerName },
        ]}
        actions={
          <>
            <MagicLinkDialog seller={seller} />
            <TokenDialog seller={seller} mode="add" />
            <TokenDialog seller={seller} mode="subtract" />
            <ToggleActiveButton seller={seller} />
            <EditSellerDialog seller={seller} teams={teams} />
            <ResetPwdDialog seller={seller} />
            {seller.is_deleted ? (
              <RestoreSellerDialog seller={seller} />
            ) : (
              <DeleteSellerDialog seller={seller} />
            )}
          </>
        }
      />

      <Card className={cn(
        'border-slate-200 bg-white shadow-sm',
        seller.is_deleted && 'border-rose-200 bg-rose-50/20',
      )}>
        <CardContent className="p-5 sm:p-6 space-y-4">
          {seller.is_deleted && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800">
                <strong>Dieser Benutzer wurde gelöscht.</strong>
                {' '}
                Er kann oben über den Wiederherstellen-Button (Pfeil rückwärts) wieder aktiviert werden.
                {seller.deleted_at && (
                  <span className="block mt-0.5 text-rose-700/80">
                    Gelöscht am {new Date(seller.deleted_at).toLocaleString('de-DE', {
                      dateStyle: 'medium', timeStyle: 'short',
                    })}
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                'flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white shadow-sm',
                seller.is_deleted
                  ? 'bg-gradient-to-br from-rose-500 to-rose-700'
                  : seller.role === 'admin'
                    ? 'bg-gradient-to-br from-indigo-500 to-indigo-700'
                    : 'bg-gradient-to-br from-slate-700 to-slate-900',
              )}>
                {sellerName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className={cn(
                    'text-lg font-semibold tracking-tight text-slate-900',
                    seller.is_deleted && 'line-through decoration-rose-400/70 decoration-1',
                  )}>
                    {sellerName}
                  </h2>
                  {seller.is_deleted && (
                    <Badge variant="destructive" className="bg-rose-600">
                      Gelöscht
                    </Badge>
                  )}
                  {seller.role === 'admin' ? (
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                      Admin
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                      Verkäufer
                    </Badge>
                  )}
                  {!seller.is_deleted && (seller.is_active ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5" />
                      Aktiv
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 mr-1.5" />
                      Deaktiviert
                    </Badge>
                  ))}
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
                <div className="mt-1 text-sm text-slate-500 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {seller.email}
                </div>
                {seller.phone && (
                  <div className="mt-0.5 text-sm text-slate-500 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {seller.phone}
                  </div>
                )}
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

      <Tabs defaultValue="performance" className="w-full pb-48">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:w-auto">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="activity">
            Aktivitäten{' '}
            <span className="ml-1 text-[10px] text-slate-400">({audits.length})</span>
          </TabsTrigger>
          <TabsTrigger value="leads">
            Leads{' '}
            <span className="ml-1 text-[10px] text-slate-400">({leads.length})</span>
          </TabsTrigger>
          <TabsTrigger value="account">
            Konto
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

        <TabsContent value="account" className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Konto erstellt"
              value={seller.created_at ? new Date(seller.created_at).toLocaleDateString('de-DE') : '—'}
              icon={<CalendarDays className="h-4 w-4" />}
              accent="brand"
              hint={seller.created_at
                ? `vor ${Math.floor((Date.now() - new Date(seller.created_at).getTime()) / (1000 * 60 * 60 * 24))} Tg.`
                : 'unbekannt'}
            />
            <StatCard
              label="Letzter Login"
              value={seller.last_login_at
                ? new Date(seller.last_login_at).toLocaleDateString('de-DE')
                : 'Nie'}
              icon={<Clock className="h-4 w-4" />}
              accent={seller.last_login_at ? 'success' : 'warning'}
              hint={seller.last_login_at
                ? new Date(seller.last_login_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                : 'noch kein Login'}
            />
            <StatCard
              label="Anzahl Audits"
              value={audits.length}
              icon={<FileText className="h-4 w-4" />}
              accent="warning"
              hint="Ereignisse (Log)"
            />
            <StatCard
              label="Rolle"
              value={seller.role === 'admin' ? 'Admin' : 'Verkäufer'}
              icon={<ShieldCheck className="h-4 w-4" />}
              accent={seller.role === 'admin' ? 'brand' : 'default'}
              hint={team ? `Team: ${team.name}` : 'Ohne Team'}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
                  <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-slate-400" />
                    Profildaten
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-5 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <AccountInfoRow icon={<UserCheck className="h-3.5 w-3.5 text-slate-400" />} label="Vollständiger Name">
                      <span className="text-sm font-medium text-slate-800">{seller.full_name ?? '—'}</span>
                    </AccountInfoRow>
                    <AccountInfoRow icon={<Mail className="h-3.5 w-3.5 text-slate-400" />} label="E-Mail">
                      <span className="text-sm font-medium text-slate-800">{seller.email ?? '—'}</span>
                    </AccountInfoRow>
                    <AccountInfoRow icon={<Phone className="h-3.5 w-3.5 text-slate-400" />} label="Telefon">
                      <span className="text-sm font-medium text-slate-800">{seller.phone ?? '—'}</span>
                    </AccountInfoRow>
                    <AccountInfoRow icon={<Users className="h-3.5 w-3.5 text-slate-400" />} label="Team">
                      <span className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                        {team ? (
                          <>
                            {team.color && (
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: team.color }}
                              />
                            )}
                            {team.name}
                          </>
                        ) : (
                          '—'
                        )}
                      </span>
                    </AccountInfoRow>
                    <AccountInfoRow icon={<ShieldCheck className="h-3.5 w-3.5 text-slate-400" />} label="Rolle">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                        seller.role === 'admin'
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-slate-100 border-slate-200 text-slate-700',
                      )}>
                        <ShieldCheck className="h-3 w-3" />
                        {seller.role === 'admin' ? 'Admin' : 'Verkäufer'}
                      </span>
                    </AccountInfoRow>
                    <AccountInfoRow icon={<Coins className="h-3.5 w-3.5 text-slate-400" />} label="Status">
                      {seller.is_deleted ? (
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium bg-rose-50 border-rose-200 text-rose-700">
                          <XCircle className="h-3 w-3" /> Gelöscht
                        </span>
                      ) : seller.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium bg-emerald-50 border-emerald-200 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Aktiv
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium bg-slate-50 border-slate-200 text-slate-500">
                          <Minus className="h-3 w-3" /> Deaktiviert
                        </span>
                      )}
                    </AccountInfoRow>
                  </div>
                  {seller.deactivation_reason && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-amber-700 flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Grund letzte Deaktivierung
                      </div>
                      <div className="text-xs text-amber-800">{seller.deactivation_reason}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
                  <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    Interne Admin-Notizen
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-5">
                  {seller.notes ? (
                    <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {seller.notes}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center">
                      <FileText className="h-5 w-5 mx-auto mb-2 text-slate-400" />
                      <div className="text-sm text-slate-500 mb-1">Keine internen Notizen hinterlegt</div>
                      <div className="text-xs text-slate-400">
                        Füge Notizen über den Button <strong>Bearbeiten</strong> in der Kopfzeile hinzu.
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
                  <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    Konto-Metadaten
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-5 space-y-3">
                  <AccountInfoRow icon={<CalendarDays className="h-3.5 w-3.5 text-slate-400" />} label="Erstellt am">
                    <div className="text-right">
                      <div className="text-xs font-medium text-slate-700 tabular-nums">
                        {seller.created_at
                          ? new Date(seller.created_at).toLocaleString('de-DE', {
                            dateStyle: 'short', timeStyle: 'short',
                          })
                          : '—'}
                      </div>
                    </div>
                  </AccountInfoRow>
                  <div className="h-px bg-slate-100" />
                  <AccountInfoRow icon={<Clock className="h-3.5 w-3.5 text-slate-400" />} label="Letzter Login">
                    <div className="text-right">
                      <div className="text-xs font-medium text-slate-700 tabular-nums">
                        {seller.last_login_at
                          ? new Date(seller.last_login_at).toLocaleString('de-DE', {
                            dateStyle: 'short', timeStyle: 'short',
                          })
                          : 'Nie'}
                      </div>
                      {seller.last_login_at && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          vor {formatRelativeShort(seller.last_login_at)}
                        </div>
                      )}
                    </div>
                  </AccountInfoRow>
                  {seller.is_deleted && (
                    <>
                      <div className="h-px bg-slate-100" />
                      <AccountInfoRow icon={<Trash2 className="h-3.5 w-3.5 text-rose-500" />} label="Gelöscht am">
                        <div className="text-right">
                          <div className="text-xs font-medium text-rose-700 tabular-nums">
                            {seller.deleted_at
                              ? new Date(seller.deleted_at).toLocaleString('de-DE', {
                                dateStyle: 'short', timeStyle: 'short',
                              })
                              : '—'}
                          </div>
                        </div>
                      </AccountInfoRow>
                    </>
                  )}
                  <div className="h-px bg-slate-100" />
                  <AccountInfoRow icon={<Coins className="h-3.5 w-3.5 text-amber-500" />} label="Wallet ID">
                    <div className="text-right">
                      <div className="font-mono text-[11px] text-slate-500 truncate max-w-[170px]" title={seller.wallet?.id ?? ''}>
                        {seller.wallet?.id ? (seller.wallet.id as string).slice(0, 10) + '…' : '—'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {seller.wallet?.balance ?? 0} Tokens
                      </div>
                    </div>
                  </AccountInfoRow>
                  <div className="h-px bg-slate-100" />
                  <AccountInfoRow icon={<ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />} label="Benutzer-ID">
                    <div className="text-right">
                      <div className="font-mono text-[11px] text-slate-500 truncate max-w-[170px]" title={seller.id ?? ''}>
                        {(seller.id as string)?.slice(0, 10) ?? '—'}…
                      </div>
                    </div>
                  </AccountInfoRow>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
                  <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-slate-400" />
                    Schnell-Aktionen
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <MagicLinkDialog seller={seller} />
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] text-slate-500 leading-relaxed">
                    <strong>Magic-Link:</strong> Erzeugt einen einmaligen Login-Link, über den sich
                    der Benutzer ohne Passwort anmelden kann. Ideal bei Passwort-Problemen.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AccountInfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-shrink-0">{icon}</div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 truncate">
          {label}
        </div>
      </div>
      <div className="min-w-0 flex-shrink-0">{children}</div>
    </div>
  )
}

function formatRelativeShort(iso: string): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diffMs / (1000 * 60))
    const hrs = Math.floor(mins / 60)
    const days = Math.floor(hrs / 24)
    if (days > 0) return `${days} Tg.`
    if (hrs > 0) return `${hrs} Std.`
    if (mins > 0) return `${mins} Min.`
    return 'gerade eben'
  } catch {
    return ''
  }
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
    SELLER_DELETED: {
      label: 'Verkäufer gelöscht',
      cls: 'bg-rose-50 border-rose-200 text-rose-700',
      icon: Trash2,
    },
    SELLER_RESTORED: {
      label: 'Verkäufer wiederhergestellt',
      cls: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      icon: Undo2,
    },
    SELLER_EMAIL_CHANGED: {
      label: 'E-Mail geändert',
      cls: 'bg-sky-50 border-sky-200 text-sky-700',
      icon: Mail,
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
