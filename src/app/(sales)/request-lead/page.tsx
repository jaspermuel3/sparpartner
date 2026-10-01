import Link from 'next/link'
import { requireSeller, getUserWallet } from '@/lib/auth'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { RequestForm } from './RequestForm'
import { ArrowLeft, Sparkles } from 'lucide-react'
import {
  getWaitlistEntry,
  getAvailableLeadCountBreakdown,
} from '@/lib/services/leads.service'
import type { WaitlistEntry } from '@/types'

export const metadata = { title: 'Lead anfordern' }

export default async function RequestLeadPage() {
  const user = await requireSeller()
  const [wallet, waitlistEntry, availableBreakdown] = await Promise.all([
    getUserWallet(user.id),
    getWaitlistEntry(user.id),
    getAvailableLeadCountBreakdown(),
  ])
  const balance = wallet?.balance ?? 0

  return (
    <div className="space-y-8">
      <PageHeader
        title="Lead anfordern"
        description="Fordere den nächsten verfügbaren Lead an. 1 Token wird abgebucht."
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Lead anfordern' },
        ]}
        actions={
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zum Dashboard
          </Link>
        }
      />
      <Card className="border-slate-200 bg-slate-50/40 shadow-sm">
        <CardContent className="p-6 sm:p-10">
          <RequestForm
            balance={balance}
            waitlistEntry={waitlistEntry}
            initialAvailable={availableBreakdown}
          />
        </CardContent>
      </Card>
    </div>
  )
}
