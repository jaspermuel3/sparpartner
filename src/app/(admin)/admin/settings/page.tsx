import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileForm } from '@/components/forms/ProfileForm'
import { DensitySelector } from '@/components/ui-custom/DensitySelectorClient'
import { CreateTeamDialog } from '../sellers/AdminSellerDialogs'
import { getAllTeams } from '@/lib/services/teams.service'
import { User, ShieldCheck, Server, Users, Maximize2 } from 'lucide-react'
import { AdminSystemPanelClient } from './AdminSystemPanelClient'
import {
  getMaintenanceMode,
  getLandingApiEnabled,
} from '@/lib/services/system.service'

export const metadata = { title: 'Einstellungen · Admin' }

export default async function AdminSettingsPage() {
  const user = await requireAdmin()
  const email = (user as any).auth_email ?? ''
  const teams = await getAllTeams()
  const [maintenance, landingApiEnabled] = await Promise.all([
    getMaintenanceMode(),
    getLandingApiEnabled(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Einstellungen"
        description="Admin-Einstellungen, Konto, Teams und System-Info."
        breadcrumb={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Einstellungen' },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 bg-white shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" />
              Admin-Konto
            </CardTitle>
            <div className="text-xs text-slate-500 pt-0.5">
              Persönliche Daten & Passwort
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ProfileForm user={user} email={email} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-400" />
                Zugriff
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="text-xs text-slate-500">Rolle</div>
                <div className="font-semibold text-slate-900 capitalize mt-0.5">Administrator</div>
              </div>
              <p className="text-xs text-slate-500">Volle Rechte auf alle Module und Benutzer.</p>
              <Link
                href="/admin/sellers"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Benutzer verwalten →
              </Link>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
                <Maximize2 className="h-4 w-4 text-slate-400" />
                Darstellung
              </CardTitle>
              <div className="text-xs text-slate-500 pt-0.5">
                Dichte der Tabellen und Cards.
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <DensitySelector />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  Teams verwalten
                </CardTitle>
                <div className="text-xs text-slate-500 pt-0.5">
                  {teams.length} Team{teams.length === 1 ? '' : 's'} angelegt.
                </div>
              </div>
              <CreateTeamDialog />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {teams.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                <Users className="h-5 w-5 mx-auto mb-2 text-slate-400" />
                <div className="text-sm font-medium text-slate-800">Noch keine Teams</div>
                <div className="mt-1 text-xs text-slate-500">
                  Erstelle dein erstes Team über „Team erstellen“.
                </div>
              </div>
            ) : (
              <ul className="space-y-2">
                {teams.map((t: any) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-slate-200 shrink-0"
                        style={{ backgroundColor: t.color ?? '#e2e8f0' }}
                      />
                      <span className="text-sm font-medium text-slate-800 truncate">
                        {t.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 ml-3">
                      ID: {String(t.id).slice(0, 8)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
              <Server className="h-4 w-4 text-slate-400" />
              System
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2 text-xs text-slate-600">
            <EnvLine label="NEXT_PUBLIC_SUPABASE_URL" hint="Supabase Project URL" />
            <EnvLine label="NEXT_PUBLIC_SUPABASE_ANON_KEY" hint="Public Anon Key" />
            <EnvLine label="SUPABASE_SERVICE_ROLE_KEY" hint="Service Role (Server-only)" />
            <p className="pt-2 border-t border-slate-100 text-slate-500">
              Stelle sicher, dass die 3 Umgebungsvariablen in{' '}
              <code className="rounded bg-slate-100 px-1">.env.local</code> gesetzt sind.
            </p>
          </CardContent>
        </Card>
      </div>

      <AdminSystemPanelClient
        initialSettings={{
          maintenance,
          landing_api_enabled: landingApiEnabled,
        }}
      />
    </div>
  )
}

function EnvLine({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/70 px-2.5 py-1.5">
      <div className="font-mono text-[11px] font-medium text-slate-800">{label}</div>
      <div className="text-[11px] text-slate-500">{hint}</div>
    </div>
  )
}
