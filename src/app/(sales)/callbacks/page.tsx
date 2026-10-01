import { requireSeller } from '@/lib/auth'
import { getMyCallbacks } from '@/lib/services/leads.service'
import { PageHeader } from '@/components/layout/PageHeader'
import CallbacksClient from './CallbacksClient'

export const metadata = { title: 'Rückrufe' }

export default async function CallbacksPage() {
  const user = await requireSeller()
  const callbacks = (await getMyCallbacks(user.id)) as any[] ?? []

  const jetzt = Date.now()
  callbacks.sort((a, b) => new Date(a.callback_at).getTime() - new Date(b.callback_at).getTime())
  const ueberfaellig = callbacks.filter((c) => c.status === 'offen' && new Date(c.callback_at).getTime() < jetzt)
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)
  const heuteISO = heute.toISOString().slice(0, 10)
  const callbacksHeute = callbacks.filter((c) => c.callback_at.slice(0, 10) === heuteISO)
  const offen = callbacks.filter((c) => c.status === 'offen')

  const breadcrumb = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Rückrufe' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rückrufe"
        description={`${offen.length} offene Rückrufe · ${callbacksHeute.length} heute · ${ueberfaellig.length} überfällig`}
        breadcrumb={breadcrumb}
      />
      <CallbacksClient callbacks={callbacks} />
    </div>
  )
}
