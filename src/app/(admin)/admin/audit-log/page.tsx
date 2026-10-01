import { requireAdmin } from '@/lib/auth'
import { getAuditLogs } from '@/lib/services/admin.service'
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
import { ShieldCheck, UserCheck, Ban, Layers, CreditCard, PhoneCall } from 'lucide-react'
import { AUDIT_ACTION_LABELS, formatDate } from '@/lib/constants'

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
}

export default async function AdminAuditPage() {
  await requireAdmin()
  const logs = (await getAuditLogs(500)) as any[] ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit-Log"
        description={`${logs.length} Einträge · Alle Aktionen werden nachverfolgt.`}
      />
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
                      <div className="text-sm font-medium text-slate-800">Noch keine Audit-Einträge</div>
                      <div className="text-xs text-slate-500 mt-1">Alle Aktionen ab dem ersten Login werden hier sichtbar.</div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log) => {
                const actionKey = (log.action ?? '') as keyof typeof AUDIT_ACTION_LABELS
                const Icon = ICON_MAP[actionKey] ?? ShieldCheck
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
