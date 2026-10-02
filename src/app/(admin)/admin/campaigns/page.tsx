import { requireAdmin } from '@/lib/auth'
import {
  getCampaignsWithStats,
} from '@/lib/services/admin.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { CampaignsOverview } from './CampaignsOverview'

export const metadata = { title: 'Kampagnen · Admin' }

export default async function AdminCampaignsPage() {
  await requireAdmin()
  const campaigns = await getCampaignsWithStats()

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Kampagnen' },
        ]}
        title="Kampagnen · Meta Ads, Landing Page & mehr"
        description="Alle Lead-Quellen im Überblick – filtere nach Kanal, durchsuche Namen und springe in die Detail-Auswertung pro Kampagne."
      />
      <CampaignsOverview initialCampaigns={campaigns as any[]} />
    </div>
  )
}
