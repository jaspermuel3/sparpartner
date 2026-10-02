import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { getUserWallet } from '@/lib/auth'
import { getMaintenanceMode } from '@/lib/services/system.service'

export const dynamic = 'force-dynamic'

export default async function SalesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'seller' && user.role !== 'admin') redirect('/login')
  if (!user.is_active) redirect('/login?error=inactive')

  if (user.role !== 'admin') {
    try {
      const mm = await getMaintenanceMode()
      if (mm.enabled) {
        const params = new URLSearchParams()
        params.set('maintenance', '1')
        params.set('m', mm.message || 'Wartungsarbeiten. Bitte versuche es später erneut.')
        redirect('/login?' + params.toString())
      }
    } catch {}
  }

  const wallet = user.role === 'seller' ? await getUserWallet(user.id) : null
  const email = (user as any).auth_email ?? user.id.slice(0, 8) + '@…'

  return (
    <Sidebar
      role={user.role}
      walletBalance={wallet?.balance ?? 0}
      fullName={user.full_name}
      email={email}
    >
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </Sidebar>
  )
}
