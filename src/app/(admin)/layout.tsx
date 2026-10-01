import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/dashboard')
  if (!user.is_active) redirect('/login?error=inactive')

  const email = (user as any).auth_email ?? user.id.slice(0, 8) + '@…'

  return (
    <Sidebar role="admin" fullName={user.full_name} email={email}>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </Sidebar>
  )
}
