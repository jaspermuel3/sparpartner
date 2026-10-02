'use client'

import { useEffect, useState } from 'react'
import { useFormState } from 'react-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Database,
  RefreshCw,
  Server as ServerIcon,
  ShieldAlert,
  Trash2,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react'
import {
  toggleMaintenanceAction,
  toggleLandingApiAction,
  runHealthCheckAction,
  clearAppCacheAction,
} from '@/app/actions'
import { SubmitButton, useActionFeedback, type ActionResult } from '@/components/ui-custom/FormHelpers'

type SettingsSnapshot = {
  maintenance: { enabled: boolean; message: string }
  landing_api_enabled: boolean
}

export function AdminSystemPanelClient({
  initialSettings,
}: {
  initialSettings: SettingsSnapshot
}) {
  const [health, setHealth] = useState<{
    loading: boolean
    data?: Awaited<ReturnType<typeof runHealthCheckAction>>
  }>({ loading: true })

  useEffect(() => {
    let mounted = true
    runHealthCheckAction()
      .then((r) => { if (mounted) setHealth({ loading: false, data: r }) })
      .catch(() => { if (mounted) setHealth({ loading: false }) })
    return () => { mounted = false }
  }, [])

  return (
    <div className="space-y-6">
      <MaintenanceSection initial={initialSettings.maintenance} />
      <LandingApiToggle initialEnabled={initialSettings.landing_api_enabled} />
      <HealthStatusCard
        health={health}
        onRefresh={async () => {
          setHealth({ loading: true })
          const r = await runHealthCheckAction()
          setHealth({ loading: false, data: r })
        }}
      />
      <CacheActionsCard />
    </div>
  )
}

/* ---------------- Maintenance ---------------- */

function MaintenanceSection({ initial }: { initial: { enabled: boolean; message: string } }) {
  const [mState, mAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await toggleMaintenanceAction(_, fd)) as any,
    null,
  )
  useActionFeedback(mState)

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className={
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' +
            (initial.enabled
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-600')
          }>
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                Wartungsmodus
              </h3>
              <StatusDot ok={!initial.enabled} okLabel="Inaktiv" badLabel="AKTIV" />
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Sperrt alle Verkäufer aus. Admins behalten Zugriff.
            </p>
          </div>
        </div>
        {initial.enabled ? (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
            <Ban className="mr-1 h-3 w-3" /> Wartung AKTIV
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="mr-1 h-3 w-3" /> System Live
          </Badge>
        )}
      </div>
      <form action={mAction} className="space-y-3 px-5 py-4">
        <div className="space-y-1.5">
          <Label htmlFor="mm-msg" className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Wartungsnachricht (Verkäufer-Sicht)
          </Label>
          <Input
            id="mm-msg"
            name="message"
            defaultValue={initial.message}
            placeholder="Wartungsarbeiten. Bitte später erneut versuchen."
            className="text-sm"
          />
        </div>
        {mState?.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {mState.error}
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <input type="hidden" name="enable" value={initial.enabled ? 'false' : 'true'} />
          <SubmitButton
            size="sm"
            variant={initial.enabled ? 'default' : 'destructive'}
            className={initial.enabled ? '' : 'bg-amber-600 hover:bg-amber-700'}
          >
            {initial.enabled ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Wartungsmodus beenden
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" />
                Wartungsmodus starten
              </>
            )}
          </SubmitButton>
        </div>
      </form>
    </div>
  )
}

/* ---------------- Landing API ---------------- */

function LandingApiToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [lState, lAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await toggleLandingApiAction(_, fd)) as any,
    null,
  )
  useActionFeedback(lState)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' +
          (initialEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')
        }>
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">
              Landing Page API
            </h3>
            <StatusDot ok={initialEnabled} okLabel="Empfang aktiv" badLabel="Gesperrt" />
          </div>
          <p className="mt-0.5 max-w-lg text-xs text-slate-500">
            Externe Lead-Annahmen von {process.env.NEXT_PUBLIC_CRM_API_URL ?? 'der Landing Page'}.
            Bei Deaktivierung werden eingehende Leads mit 503 abgewiesen.
          </p>
        </div>
      </div>
      <form action={lAction} className="flex items-center gap-2">
        <input type="hidden" name="enable" value={initialEnabled ? 'false' : 'true'} />
        {lState?.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
            {lState.error}
          </div>
        )}
        <SubmitButton size="sm" variant={initialEnabled ? 'destructive' : 'default'}>
          {initialEnabled ? (
            <>
              <XCircle className="h-4 w-4" /> API stoppen
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" /> API starten
            </>
          )}
        </SubmitButton>
      </form>
    </div>
  )
}

/* ---------------- Health + Connection Status ---------------- */

function HealthStatusCard({
  health,
  onRefresh,
}: {
  health: { loading: boolean; data?: Awaited<ReturnType<typeof runHealthCheckAction>> }
  onRefresh: () => void
}) {
  const status = health.data?.ok ? health.data.status : null

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
            <ServerIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">
              Verbindungsstatus
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Echtzeit-Überprüfung der Systemkomponenten.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={health.loading}
        >
          <RefreshCw className={'h-4 w-4 ' + (health.loading ? 'animate-spin' : '')} />
          Status prüfen
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
        <HealthLine
          title="Supabase DB"
          icon={<Database className="h-3.5 w-3.5" />}
          loading={health.loading}
          ok={status?.supabase_db.ok}
          subtitle={
            status?.supabase_db.ok
              ? `Latenz ~${status.supabase_db.latency_ms}ms`
              : status?.supabase_db.error ?? 'Keine Verbindung'
          }
        />
        <HealthLine
          title="pg_cron (Auto-Archiv)"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          loading={health.loading}
          ok={status?.pg_cron.ok}
          subtitle={
            status?.pg_cron.ok
              ? 'Extension geladen'
              : status?.pg_cron.error ?? 'Extension nicht verfügbar'
          }
          warnIfBad
        />
        <EnvStatusCard loading={health.loading} env={status?.env_vars} />
      </div>
    </div>
  )
}

function HealthLine({
  title,
  icon,
  loading,
  ok,
  subtitle,
  warnIfBad,
}: {
  title: string
  icon: React.ReactNode
  loading?: boolean
  ok?: boolean
  subtitle: string
  warnIfBad?: boolean
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-500 shrink-0">{icon}</span>
          <span className="text-xs font-semibold text-slate-800 truncate">{title}</span>
        </div>
        {loading ? (
          <span className="text-[10px] text-slate-400">…</span>
        ) : ok ? (
          <Badge variant="secondary" className="h-5 bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="mr-0.5 h-3 w-3" /> OK
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className={
              'h-5 ' +
              (warnIfBad
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-rose-200 bg-rose-50 text-rose-700')
            }
          >
            <XCircle className="mr-0.5 h-3 w-3" /> Fehler
          </Badge>
        )}
      </div>
      <div className="mt-1 pl-5.5 text-[11px] text-slate-500 truncate">{subtitle}</div>
    </div>
  )
}

function EnvStatusCard({
  loading,
  env,
}: {
  loading?: boolean
  env?: {
    supabase_url: boolean
    supabase_anon_key: boolean
    service_role_key: boolean
    landing_api_key: boolean
  }
}) {
  const items = [
    { key: 'SUPABASE_URL', ok: env?.supabase_url },
    { key: 'ANON_KEY', ok: env?.supabase_anon_key },
    { key: 'SERVICE_ROLE', ok: env?.service_role_key },
    { key: 'LANDING_API_KEY', ok: env?.landing_api_key },
  ]
  const allOk = items.every((i) => i.ok)
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 sm:col-span-2 lg:col-span-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-500 shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-semibold text-slate-800 truncate">
            Umgebungsvariablen
          </span>
        </div>
        {loading ? (
          <span className="text-[10px] text-slate-400">…</span>
        ) : allOk ? (
          <Badge variant="secondary" className="h-5 bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="mr-0.5 h-3 w-3" /> vollständig
          </Badge>
        ) : (
          <Badge variant="outline" className="h-5 border-rose-200 bg-rose-50 text-rose-700">
            <XCircle className="mr-0.5 h-3 w-3" /> unvollständig
          </Badge>
        )}
      </div>
      <div className="mt-1.5 pl-1 grid grid-cols-2 gap-1">
        {items.map((i) => (
          <div key={i.key} className="flex items-center gap-1.5 text-[10.5px]">
            <span
              className={
                'h-1.5 w-1.5 shrink-0 rounded-full ' +
                (loading
                  ? 'bg-slate-300'
                  : i.ok
                    ? 'bg-emerald-500'
                    : 'bg-rose-500')
              }
            />
            <span className="font-mono text-slate-600 truncate">{i.key}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Cache Actions ---------------- */

function CacheActionsCard() {
  const [cState, cAction] = useFormState<ActionResult | null, FormData>(
    async (_, fd) => (await clearAppCacheAction()) as any,
    null,
  )
  useActionFeedback(cState)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
          <Trash2 className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">
            Cache &amp; Revalidation
          </h3>
          <p className="mt-0.5 max-w-lg text-xs text-slate-500">
            Leert den App-Router-Cache für alle Kernpfade (Dashboard, Leads, Seller, Stats, Tokens …).
            Nach Schema-Änderungen oder Migrationen nützlich.
          </p>
        </div>
      </div>
      <form action={cAction} className="flex items-center gap-2">
        {cState?.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
            {cState.error}
          </div>
        )}
        <SubmitButton size="sm" variant="outline">
          <RefreshCw className="h-4 w-4" />
          App Cache leeren
        </SubmitButton>
      </form>
    </div>
  )
}

/* ---------------- Shared UI Helpers ---------------- */

function StatusDot({
  ok,
  okLabel,
  badLabel,
}: {
  ok?: boolean
  okLabel: string
  badLabel: string
}) {
  const cls = ok
    ? 'bg-emerald-500'
    : 'bg-amber-500 animate-pulse'
  const label = ok ? okLabel : badLabel
  const labelCls = ok ? 'text-emerald-700' : 'text-amber-700'
  return (
    <span className={'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ' + labelCls}>
      <span className={'h-1.5 w-1.5 rounded-full ' + cls} />
      {label}
    </span>
  )
}
