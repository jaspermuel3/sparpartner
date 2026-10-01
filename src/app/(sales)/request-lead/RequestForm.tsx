'use client'

import { useFormState, useFormStatus } from 'react-dom'
import {
  requestLeadAction,
  joinWaitlistAction,
  leaveWaitlistAction,
  getAvailableLeadCountsAction,
} from '@/app/actions'
import { SubmitButton, useActionFeedback, type ActionResult } from '@/components/ui-custom/FormHelpers'
import {
  AlertTriangle,
  Zap,
  Sparkles,
  CheckCircle2,
  Clock,
  X,
  Package2,
  Loader2,
  ArrowRight,
  Layers3,
  RefreshCw,
} from 'lucide-react'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { PRODUCT_LABELS } from '@/lib/constants'
import type { ProductType, WaitlistEntry } from '@/types'
import { ConfettiBurst } from '@/components/ui-custom/ConfettiBurst'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

type ProductOption = ProductType | 'all'

const PRODUCT_OPTIONS: Array<{ value: ProductOption; label: string }> = [
  { value: 'all', label: 'Alle Produkte' },
  { value: 'strom', label: PRODUCT_LABELS.strom },
  { value: 'gas', label: PRODUCT_LABELS.gas },
  { value: 'beides', label: PRODUCT_LABELS.beides },
]

const COOLDOWN_MS = 4000
const POLL_INTERVAL_MS = 6000

type AvailableBreakdown = { total: number; strom: number; gas: number; beides: number }
const DEFAULT_BREAKDOWN: AvailableBreakdown = { total: 0, strom: 0, gas: 0, beides: 0 }

export function RequestForm({
  balance,
  waitlistEntry: initialWaitlist,
  initialAvailable,
}: {
  balance: number
  waitlistEntry: WaitlistEntry | null
  initialAvailable?: AvailableBreakdown | null
}) {
  const router = useRouter()
  const [product, setProduct] = useState<ProductOption>('all')
  const [burstActive, setBurstActive] = useState(false)
  const [available, setAvailable] = useState<AvailableBreakdown>(initialAvailable ?? DEFAULT_BREAKDOWN)
  const [countPop, setCountPop] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshAvailable = useCallback(async (silent = true) => {
    if (!silent) setIsRefreshing(true)
    try {
      const res = await getAvailableLeadCountsAction()
      if (res.ok && res.breakdown) {
        setAvailable((prev) => {
          const next = res.breakdown as AvailableBreakdown
          const changed =
            prev.total !== next.total ||
            prev.strom !== next.strom ||
            prev.gas !== next.gas ||
            prev.beides !== next.beides
          if (changed) {
            setCountPop(true)
            window.setTimeout(() => setCountPop(false), 350)
          }
          return next
        })
      }
    } catch {
      // ignore poll errors
    } finally {
      if (!silent) setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const id = window.setInterval(() => {
      if (mounted) refreshAvailable(true)
    }, POLL_INTERVAL_MS)
    return () => {
      mounted = false
      window.clearInterval(id)
    }
  }, [refreshAvailable])

  useEffect(() => {
    const onSetProduct = (e: Event) => {
      const ce = e as CustomEvent<ProductOption>
      const value = ce.detail
      if (
        value === 'all' ||
        value === 'strom' ||
        value === 'gas' ||
        value === 'beides'
      ) {
        setProduct(value)
      }
    }
    window.addEventListener('request-lead:set-product', onSetProduct as EventListener)
    return () => {
      window.removeEventListener('request-lead:set-product', onSetProduct as EventListener)
    }
  }, [])

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

  // Button-Zustände für Animationen
  const [btnError, setBtnError] = useState(false)
  const [btnSuccess, setBtnSuccess] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [cooldownPct, setCooldownPct] = useState(0)
  const [redirecting, setRedirecting] = useState<string | null>(null)
  const [centerConfirm, setCenterConfirm] = useState(false)

  useEffect(() => {
    if (requestState?.ok && requestState?.leadAssigned) {
      setBurstActive(true)
      setBtnSuccess(true)
      setCenterConfirm(true)
      setBtnError(false)
      const target = typeof requestState.redirectTo === 'string' ? requestState.redirectTo : null
      if (target) {
        setTimeout(() => {
          setRedirecting(target)
          setTimeout(() => router.push(target), 180)
        }, 220)
      }
      const t = setTimeout(() => setBtnSuccess(false), 1800)
      const c = setTimeout(() => setCenterConfirm(false), 2000)
      return () => {
        clearTimeout(t)
        clearTimeout(c)
      }
    }
  }, [requestState, router])

  useEffect(() => {
    if (requestState?.error && !requestState?.ok) {
      setBtnSuccess(false)
      setBtnError(true)
      setCooldownUntil(Date.now() + COOLDOWN_MS)
      const t = setTimeout(() => setBtnError(false), 700)
      return () => clearTimeout(t)
    }
  }, [requestState])

  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownPct(0)
      return
    }
    let raf = 0
    const tick = () => {
      const left = Math.max(0, cooldownUntil - Date.now())
      const pct = (left / COOLDOWN_MS) * 100
      setCooldownPct(pct)
      if (left > 0) raf = requestAnimationFrame(tick)
      else setCooldownUntil(null)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cooldownUntil])

  const cooldownLeftSec = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
    : 0

  useEffect(() => {
    if (requestState?.ok && requestState?.leadAssigned) {
      const t = window.setTimeout(() => refreshAvailable(false), 350)
      return () => window.clearTimeout(t)
    }
  }, [requestState, refreshAvailable])

  const activeCount =
    product === 'all'
      ? available.total
      : product === 'strom'
        ? available.strom
        : product === 'gas'
          ? available.gas
          : available.beides

  return (
    <div className="flex flex-col items-center justify-center gap-6 relative">
      <ConfettiBurst active={burstActive} onDone={() => setBurstActive(false)} />

      {centerConfirm && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center fade-slide-up">
          <div className="bg-emerald-600 text-white px-10 py-6 rounded-2xl shadow-2xl shadow-emerald-900/40 border border-emerald-400/30 max-w-md w-[90%]">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/30 ring-1 ring-emerald-300/40">
                <CheckCircle2 className="h-8 w-8 text-emerald-100" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-white">
                Lead zugewiesen
              </div>
              <div className="text-sm text-emerald-100/90">
                Du wirst direkt zur Lead-Detailseite weitergeleitet
              </div>
            </div>
          </div>
        </div>
      )}

      {redirecting ? (
        <RedirectSkeleton href={redirecting} />
      ) : (
        <>
          <ProductFilter product={product} onChange={setProduct} disabled={disabled || !!cooldownUntil} />

          <LiveAvailablePanel
            product={product}
            available={available}
            activeCount={activeCount}
            countPop={countPop}
            isRefreshing={isRefreshing}
            onManualRefresh={() => refreshAvailable(false)}
          />

          {balance <= 0 ? (
            <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-left fade-slide-up">
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
            <div className="w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 p-4 text-left fade-slide-up">
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

          <div className="relative w-full max-w-lg">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-sky-500/15 via-blue-500/15 to-indigo-500/15 blur-xl" />
            <div className="relative rounded-2xl border border-slate-200 bg-white px-5 py-7 sm:px-8 sm:py-9 shadow-lg shadow-slate-900/5">
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-md shadow-slate-900/15">
                <Zap className="h-6 w-6" />
              </div>
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 text-center">Aktuelles Guthaben</div>
              <div className="mt-2 flex items-baseline justify-center gap-2">
                <span className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl tabular-nums">{balance}</span>
                <span className="text-base font-medium text-slate-500">Tokens</span>
              </div>
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                1 Lead kostet genau 1 Token
              </div>

              <div className="mx-auto mt-8 max-w-sm space-y-3">
                <AnimatedRequestForm
                  formAction={requestFormAction}
                  product={product}
                  disabled={disabled || !!cooldownUntil}
                  btnError={btnError}
                  btnSuccess={btnSuccess}
                />

                {cooldownUntil ? (
                  <div className="space-y-1.5 fade-slide-up">
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Nächster Request in {cooldownLeftSec}s
                      </span>
                      <span className="tabular-nums">{Math.round(100 - cooldownPct)}%</span>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-slate-400 to-slate-600 transition-[width] duration-75"
                        style={{ width: `${100 - cooldownPct}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                {disabled && !cooldownUntil ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 fade-slide-up">
                    Button deaktiviert: Keine Tokens verfügbar.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {noLeadAvailable && !initialWaitlist && !disabled ? (
            <form action={waitlistFormAction} className="pt-2 w-full max-w-sm">
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
        </>
      )}
    </div>
  )
}

function AnimatedRequestForm({
  formAction,
  product,
  disabled,
  btnError,
  btnSuccess,
}: {
  formAction: (payload: FormData) => void
  product: ProductOption
  disabled?: boolean
  btnError: boolean
  btnSuccess: boolean
}) {
  const { pending } = useFormStatus()
  const showPulse = pending || btnSuccess
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="product" value={product === 'all' ? '' : product} />
      <button
        type="submit"
        disabled={disabled || pending || btnSuccess}
        className={cn(
          'group relative inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold shadow-md shadow-slate-900/10 transition-all duration-200',
          'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 hover:from-slate-800 hover:via-slate-700 hover:to-slate-800 text-white',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-60',
          showPulse && 'btn-pulse',
          btnError && 'shake',
        )}
      >
        {btnSuccess ? (
          <>
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-300" />
            Lead zugewiesen
          </>
        ) : pending ? (
          <>
            <Loader2 className="h-4.5 w-4.5 animate-spin opacity-80" />
            Lead wird zugewiesen…
          </>
        ) : (
          <>
            <Zap className={cn('h-4.5 w-4.5 transition-transform group-hover:scale-110', btnError ? 'text-red-300' : '')} />
            Lead anfordern
          </>
        )}
      </button>
    </form>
  )
}

function RedirectSkeleton({ href }: { href: string }) {
  return (
    <div className="w-full max-w-lg fade-slide-up">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-7 sm:px-8 sm:py-9 shadow-lg shadow-slate-900/5">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/80" />
        <div className="relative flex flex-col items-center text-center">
          <div className="relative mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-900/15">
            <CheckCircle2 className="h-6 w-6" />
            <span className="absolute inset-0 rounded-xl bg-emerald-400/30 blur-lg -z-10" />
          </div>
          <div className="text-sm font-semibold text-slate-900">Lead zugewiesen</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <span>Leiten weiter</span>
            <ArrowRight className="h-3 w-3 animate-pulse" />
            <span className="tabular-nums font-mono text-slate-700">{href}</span>
          </div>
          <div className="mt-8 w-full max-w-sm space-y-3">
            <div className="h-12 w-full animate-pulse rounded-xl bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
              <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
              <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
            </div>
          </div>
        </div>
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

function LiveAvailablePanel({
  product,
  available,
  activeCount,
  countPop,
  isRefreshing,
  onManualRefresh,
}: {
  product: ProductOption
  available: AvailableBreakdown
  activeCount: number
  countPop: boolean
  isRefreshing: boolean
  onManualRefresh: () => void
}) {
  const items: Array<{ key: ProductOption; label: string; value: number }> = [
    { key: 'all', label: 'Alle Produkte', value: available.total },
    { key: 'strom', label: PRODUCT_LABELS.strom, value: available.strom },
    { key: 'gas', label: PRODUCT_LABELS.gas, value: available.gas },
    { key: 'beides', label: PRODUCT_LABELS.beides, value: available.beides },
  ]
  return (
    <div className="w-full max-w-3xl fade-slide-up">
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
              <Layers3 className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 leading-none">
                Lead-Pool · Live
              </div>
              <div className="text-[13px] font-semibold text-slate-900 leading-tight mt-0.5">
                Verfügbare Leads nach Produkt
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onManualRefresh}
            disabled={isRefreshing}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
            {isRefreshing ? 'Lädt…' : 'Aktualisieren'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 sm:gap-2.5">
          {items.map((it) => {
            const active = product === it.key
            const zero = it.value <= 0
            const doPop = countPop && active
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    const ev = new CustomEvent('request-lead:set-product', { detail: it.key })
                    window.dispatchEvent(ev)
                  }
                }}
                className={cn(
                  'group relative flex flex-col items-center justify-center gap-0.5 rounded-lg border px-2.5 py-3 transition-all duration-200 text-center',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2',
                  active
                    ? 'border-emerald-300 bg-emerald-50/60 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <div
                  className={cn(
                    'text-[10px] font-medium uppercase tracking-wider transition-colors leading-none',
                    active ? 'text-emerald-600' : 'text-slate-500',
                  )}
                >
                  {it.label}
                </div>
                <div
                  className={cn(
                    'flex items-baseline gap-1 tabular-nums transition-transform duration-300',
                    doPop && 'scale-[1.08]',
                  )}
                >
                  <span
                    className={cn(
                      'text-2xl font-semibold tracking-tight transition-colors leading-none',
                      zero
                        ? 'text-slate-300'
                        : active
                          ? 'text-emerald-700'
                          : 'text-slate-900',
                    )}
                  >
                    {it.value}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-medium leading-none',
                      zero
                        ? 'text-slate-300'
                        : active
                          ? 'text-emerald-600'
                          : 'text-slate-400',
                    )}
                  >
                    Stk.
                  </span>
                </div>
                {active && !zero && (
                  <span className="absolute -top-1 -right-1 inline-flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white shadow-sm">
                    <span className="h-1 w-1 rounded-full bg-white" />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Automatische Aktualisierung alle {POLL_INTERVAL_MS / 1000}s
          </div>
          <div>
            Aktuell{' '}
            <span className="font-semibold text-slate-800">
              {activeCount === 0 ? 'keine' : activeCount}
            </span>{' '}
            Leads für{' '}
            <span className="font-medium text-slate-700">
              „
              {product === 'all'
                ? 'Alle Produkte'
                : PRODUCT_LABELS[product as ProductType]}
              “
            </span>
          </div>
        </div>
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
