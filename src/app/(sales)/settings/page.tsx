import { requireSeller } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileForm } from '@/components/forms/ProfileForm'
import { NotificationPrefsCard } from '@/components/ui-custom/NotificationPrefsClient'
import { DensitySelector } from '@/components/ui-custom/DensitySelectorClient'
import { User, ShieldCheck, Maximize2 } from 'lucide-react'

export const metadata = { title: 'Einstellungen' }

export default async function SettingsPage() {
  const user = await requireSeller()
  const email = (user as any).auth_email ?? ''
  const userId = user.id

  const admin = createAdminClient()
  const { data: prefs } = await admin
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Einstellungen"
        description="Verwalte dein Konto, Benachrichtigungen und Darstellung."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
                <User className="h-4 w-4 text-slate-400" />
                Konto
              </CardTitle>
              <div className="text-xs text-slate-500 pt-0.5">
                Persönliche Daten & Passwort
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ProfileForm user={user} email={email} />
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <NotificationPrefsCard initialPrefs={(prefs as any) ?? undefined} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight">Deine Rolle</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="text-xs text-slate-500">Aktive Rolle</div>
                <div className="font-semibold text-slate-900 capitalize mt-0.5">
                  {user.role === 'admin' ? 'Administrator' : 'Verkäufer'}
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Rollen werden ausschließlich von Administratoren vergeben.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight">Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                {user.is_active ? 'Aktiv' : 'Deaktiviert'}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
                <Maximize2 className="h-4 w-4 text-slate-400" />
                Darstellung
              </CardTitle>
              <div className="text-xs text-slate-500 pt-0.5">
                Dichte der Tabellen und Cards anpassen.
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <DensitySelector />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
