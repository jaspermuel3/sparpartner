'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import { adminReviewCancellationAction } from '@/app/actions'
import { SubmitButton, useActionFeedback, type ActionResult } from '@/components/ui-custom/FormHelpers'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CheckCircle2,
  XCircle,
  FileX2,
  ShieldCheck,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Coins,
} from 'lucide-react'
import { formatDate, PRODUCT_LABELS, LEAD_STATUS_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type CancellationRequest = {
  id: string
  lead_id: string
  requested_by: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  refund_tokens: boolean
  created_at: string
  lead?: {
    id: string
    first_name?: string | null
    last_name?: string | null
    product?: string
    status?: string
    assigned_user_id?: string | null
    token_cost?: number
    campaign_id?: string | null
  } | null
  requester?: { id: string; full_name?: string | null } | null
  approver?: { id: string; full_name?: string | null } | null
}

export function CancellationPanelClient({
  initialRequests,
}: {
  initialRequests: CancellationRequest[]
}) {
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const filtered = initialRequests.filter((r) => (tab === 'all' ? true : r.status === tab))
  const pendingCount = initialRequests.filter((r) => r.status === 'pending').length

  return (
    <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
              <FileX2 className="h-4 w-4 text-slate-400" />
              Lead-Stornierungen
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              Verkäufer beantragen Stornos – Admin genehmigt oder lehnt ab (optional Token-Rückerstattung)
            </p>
          </div>
          {pendingCount > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 shadow-sm">
              <Clock className="h-3 w-3" />
              {pendingCount} ausstehend{pendingCount === 1 ? '' : 'e'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((t) => {
            const c = initialRequests.filter((r) => (t === 'all' ? true : r.status === t)).length
            const active = tab === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition',
                  active
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                )}
              >
                {t === 'pending' && <Clock className="h-3 w-3" />}
                {t === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                {t === 'rejected' && <XCircle className="h-3 w-3" />}
                {t === 'all' && <ShieldCheck className="h-3 w-3" />}
                {t === 'pending' ? 'Ausstehend' : t === 'approved' ? 'Genehmigt' : t === 'rejected' ? 'Abgelehnt' : 'Alle'}
                <span className={cn('rounded px-1.5 py-0.5 text-[10px] tabular-nums', active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500')}>
                  {c}
                </span>
              </button>
            )
          })}
        </div>
      </CardHeader>
      <CardContent className="pt-0 p-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 bg-slate-50 px-6 py-10 rounded-lg m-4 text-center">
            <FileX2 className="h-6 w-6 text-slate-400 mb-2" />
            <div className="text-sm font-medium text-slate-800">Keine Einträge gefunden</div>
            <div className="text-xs text-slate-500 mt-1 max-w-xs">
              {tab === 'pending'
                ? 'Aktuell gibt es keine ausstehenden Stornierungsanfragen.'
                : tab === 'approved'
                  ? 'Es wurden noch keine Stornierungen genehmigt.'
                  : tab === 'rejected'
                    ? 'Es wurden noch keine Stornierungen abgelehnt.'
                    : 'Es sind noch keine Stornierungen eingegangen.'}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead className="hidden md:table-cell">Verkäufer</TableHead>
                  <TableHead className="hidden lg:table-cell">Status · Produkt</TableHead>
                  <TableHead className="w-1/3">Grund</TableHead>
                  <TableHead className="text-right">Antrag</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className={cn(r.status === 'pending' && 'bg-amber-50/40')}>
                    <TableCell>
                      <div className="text-sm font-medium text-slate-900">
                        {r.lead
                          ? `${r.lead.first_name ?? '—'} ${r.lead.last_name ?? '—'}`
                          : `Lead #${r.lead_id.slice(0, 8)}`}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        #{r.lead_id.slice(0, 10)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm text-slate-800">
                        {r.requester?.full_name ?? 'Unbekannt'}
                      </div>
                      {r.status === 'approved' && r.approver && (
                        <div className="text-[11px] text-emerald-600 mt-0.5">
                          ✓ {r.approver.full_name ?? 'Admin'}
                        </div>
                      )}
                      {r.status === 'rejected' && r.approver && (
                        <div className="text-[11px] text-red-600 mt-0.5">
                          ✗ {r.approver.full_name ?? 'Admin'}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-slate-700 w-fit">
                          {r.lead?.status ? LEAD_STATUS_LABELS[r.lead.status as keyof typeof LEAD_STATUS_LABELS] ?? r.lead.status : '—'}
                        </span>
                        <span className="text-[10.5px] text-slate-500">
                          {r.lead?.product ? PRODUCT_LABELS[r.lead.product as keyof typeof PRODUCT_LABELS] ?? r.lead.product : '—'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-slate-700 max-w-xs line-clamp-2">
                        {r.reason}
                      </div>
                      {r.status !== 'pending' && r.review_notes && (
                        <div className="text-[11px] text-slate-500 mt-1 italic border-l-2 border-slate-200 pl-2">
                          Admin: {r.review_notes}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="text-[10.5px] text-slate-500 mt-1 tabular-nums">
                        {formatDate(r.created_at)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === 'pending' ? (
                        <div className="inline-flex items-center gap-1 justify-end">
                          <ReviewDialog requestId={r.id} decision="approve" defaultRefund={(r.lead?.token_cost ?? 0) > 0} />
                          <ReviewDialog requestId={r.id} decision="reject" />
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          {r.reviewed_at ? formatDate(r.reviewed_at) : '—'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700">
        <Clock className="h-3 w-3" /> Ausstehend
      </span>
    )
  }
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Genehmigt
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10.5px] font-semibold text-red-700">
      <XCircle className="h-3 w-3" /> Abgelehnt
    </span>
  )
}

function ReviewDialog({
  requestId,
  decision,
  defaultRefund,
}: {
  requestId: string
  decision: 'approve' | 'reject'
  defaultRefund?: boolean
}) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await adminReviewCancellationAction(fd)) as any,
    null,
  )
  useActionFeedback(state)

  const isApprove = decision === 'approve'
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 px-2',
            isApprove
              ? 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
              : 'text-red-700 border-red-200 hover:bg-red-50',
          )}
          title={isApprove ? 'Storno genehmigen' : 'Storno ablehnen'}
          aria-label={isApprove ? 'Storno genehmigen' : 'Storno ablehnen'}
        >
          {isApprove ? (
            <ThumbsUp className="h-3.5 w-3.5" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApprove ? (
              <>
                <ThumbsUp className="h-4 w-4 text-emerald-600" />
                Stornierung genehmigen?
              </>
            ) : (
              <>
                <ThumbsDown className="h-4 w-4 text-red-600" />
                Stornierung ablehnen?
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? 'Der Lead wird gelöscht. Du kannst optional die Tokens an den Verkäufer zurückerstatten.'
              : 'Der Lead bleibt erhalten und beim Verkäufer. Bitte gib eine kurze Begründung an.'}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="decision" value={decision} />
          {isApprove && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="refund"
                  value="on"
                  defaultChecked={!!defaultRefund}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium flex items-center gap-1.5 text-emerald-800">
                    <Coins className="h-3.5 w-3.5" />
                    Token erstatten
                  </div>
                  <div className="text-xs text-emerald-700">
                    Die ursprünglich für diesen Lead bezahlte Token-Menge wird zurückgebucht.
                  </div>
                </div>
              </label>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{isApprove ? 'Anmerkung (optional)' : 'Begründung'}</Label>
            <Textarea
              name="notes"
              rows={2}
              placeholder={isApprove ? 'z.B. Fehler bei Datenübermittlung…' : 'Warum wird die Stornierung abgelehnt?'}
            />
          </div>
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {typeof state.error === 'string' ? state.error : 'Es ist ein Fehler aufgetreten.'}
            </div>
          )}
          <DialogFooter>
            <SubmitButton variant={isApprove ? 'default' : 'destructive'} size="sm">
              {isApprove ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Genehmigen
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-1.5" /> Ablehnen
                </>
              )}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
