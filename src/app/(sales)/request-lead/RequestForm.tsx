'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { requestLeadAction, joinWaitlistAction, leaveWaitlistAction } from '@/app/actions'
import { SubmitButton, useActionFeedback, type ActionResult } from '@/components/ui-custom/FormHelpers'
import { AlertTriangle, Zap, Sparkles, CheckCircle2, Clock, X, Package2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PRODUCT_LABELS } from '@/lib/constants'
import type { ProductType, WaitlistEntry } from '@/types'
import { ConfettiBurst } from '@/components/ui-custom/ConfettiBurst'
import { cn } from '@/lib/utils'

type ProductOption = ProductType | 'all'

const PRODUCT_OPTIONS: Array<{ value: ProductOption; label: string }> = [
  { value: 'all', label: 'Alle Produkte' },
  { value: 'strom', label: PRODUCT_LABELS.strom },
  { value: 'gas', label: PRODUCT_LABELS.gas },
  { value: 'beides', label: PRODUCT_LABELS.beides },
]

export function RequestForm({
  balance,
  waitlistEntry: initialWaitlist,
}: {
  balance: number
  waitlistEntry: WaitlistEntry | null
}) {
  const [product, setProduct] = useState<ProductOption>('all')
  const [burstActive, setBurstActive] = useState(false)

  const [requestState, requestFormAction] = useFormState<ActionResult | null, FormData>(
    async (_prev, data) => requestLeadAction(data) as any,
    null,
  )
  const [waitlistState, waitlistFormAction] = useFormState<ActionResult | null, FormData>(
    async (_prev, data) => joinWaitlistAction(data) as any,
    null,
  )
  const [leaveState, leaveFormAction] = useFormState<ActionResult | null, FormData>(
    async () => leaveWaitlistAction() as any,
    null,
  )

  useActionFeedback(requestState)
  useActionFeedback(waitlistState)
  useActionFeedback(leaveState)

  const noLeadAvailable = requestState?.error?.includes('kein Lead verfügbar') ?? false
  const disabled = balance <= 0

  useEffect(() => {
    if (requestState?.ok && requestState?.leadAssigned) {
      setBurstActive(true)
    }
  }, [requestState])

  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <ConfettiBurst active={burstActive} onDone={() => setBurstActive(false)} />

      <ProductFilter product={product} onChange={setProduct} disabled={disabled} />

      {balance <= 0 ? (
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-left">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <div className="text-sm font-semibold text-red-800">Keine Tokens mehr</div>
              <div className="mt-0.5 text-xs text-red-700">
                Dein Guthaben ist aufgebraucht. Bitte kontaktiere einen Administrator, um weitere Tokens zu erhalten.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {requestState?.error && !noLeadAvailable ? (
        <div className="w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <div className="text-sm font-semibold text-amber-800">Hinweis</div>
              <div className="mt-0.5 text-xs text-amber-700">{requestState.error}</div>
            </div>
          </div>
        </div>
      ) : null}

      {initialWaitlist || waitlistState?.ok ? (
        <WaitlistCard
          product={initialWaitlist?.product ?? (product !== 'all' ? product : undefined)}
          createdAt={initialWaitlist?.created_at ?? new Date().toISOString()}
          leaveFormAction={leaveFormAction}
        />
      ) : null}

      <div className="relative w-full max-w-xl">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-sky-500/20 via-blue-500/20 to-indigo-500/20 blur-xl" />
        <div className="relative rounded-3xl border border-slate-200 bg-white px-6 py-10 sm:px-10 sm:py-14 shadow-xl shadow-slate-900/5">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-lg shadow-slate-900/20">
            <Zap className="h-8 w-8" />
          </div>
          <div className="text-xs font-medium uppercase tracking-widest text-slate-400">Aktuelles Guthaben</div>
          <div className="mt-2 flex items-baseline justify-center gap-2">
            <span className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl tabular-nums">{balance}</span>
            <span className="text-lg font-medium text-slate-500">Tokens</span>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            1 Lead kostet genau 1 Token
          </div>

          <div className="mx-auto mt-10 max-w-sm space-y-3">
            <form action={requestFormAction} className="space-y-3">
              <input type="hidden" name="product" value={product === 'all' ? '' : product} />
              <SubmitButton
                disabled={disabled}
                className="h-14 w-full rounded-xl text-base font-semibold shadow-lg shadow-slate-900/10 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 hover:from-slate-800 hover:via-slate-700 hover:to-slate-800 transition-all"
                variant="default"
                size="lg"
                pendingLabel="Lead wird zugewiesen…"
              >
                <Zap className="h-5 w-5" />
                Lead anfordern
              </SubmitButton>
              {disabled && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Button deaktiviert: Keine Tokens verfügbar.
                </div>
              )}
            </form>

            {noLeadAvailable && !initialWaitlist && !disabled ? (
              <form action={waitlistFormAction} className="pt-2">
                <input type="hidden" name="product" value={product === 'all' ? '' : product} />
                <SubmitButton
                  className="h-12 w-full rounded-xl text-sm font-semibold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 shadow-none"
                  variant="outline"
                  size="lg"
                  pendingLabel="Warteliste…"
                >
                  <Clock className="h-4 w-4" />
                  Auf Warteliste setzen
                </SubmitButton>
                <p className="mt-2 text-center text-[11px] text-slate-500">
                  Du wirst benachrichtigt, sobald ein passender Lead verfügbar ist.
                </p>
              </form>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3 pt-4">
        <InfoCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          title="FIFO-Vergabe"
          body="Du erhältst den ältesten verfügbaren Lead."
        />
        <InfoCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          title="Sichere Zuweisung"
          body="Jeder Lead wird nur einmal vergeben."
        />
        <InfoCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          title="Sofort weiter"
          body="Nach der Zuweisung gelangst du direkt zum Lead."
        />
      </div>
    </div>
  )
}

function ProductFilter({
  product,
  onChange,
  disabled,
}: {
  product: ProductOption
  onChange: (p: ProductOption) => void
  disabled?: boolean
}) {
  return (
    <div className="w-full max-w-3xl">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
        <Package2 className="h-3.5 w-3.5" />
        Produktfilter
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PRODUCT_OPTIONS.map((opt) => {
          const active = product === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
                active
                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300',
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WaitlistCard({
  product,
  createdAt,
  leaveFormAction,
}: {
  product?: ProductType
  createdAt: string
  leaveFormAction: (payload: FormData) => void
}) {
  const { pending } = useFormStatus()
  const dateText = useMemo(() => {
    try {
      const d = new Date(createdAt)
      return d.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return createdAt
    }
  }, [createdAt])

  return (
    <div className="w-full max-w-3xl rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Du befindest dich auf der Warteliste</div>
            <div className="mt-1 text-xs text-slate-600">
              <span>Eingetragen am {dateText}</span>
              {product ? (
                <>
                  <span className="mx-1.5 text-slate-300">•</span>
                  <span>Produkt: <span className="font-medium text-slate-800">{PRODUCT_LABELS[product]}</span></span>
                </>
              ) : null}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Du wirst automatisch benachrichtigt, sobald ein neuer Lead verfügbar ist.
            </div>
          </div>
        </div>
        <form action={leaveFormAction} className="shrink-0">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            {pending ? 'Wird entfernt…' : 'Warteliste verlassen'}
          </button>
        </form>
      </div>
    </div>
  )
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card-hoverable flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50">{icon}</div>
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-0.5 text-xs text-slate-500">{body}</div>
      </div>
    </div>
  )
}
