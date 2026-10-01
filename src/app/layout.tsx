import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster as SonnerToaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DensityProvider } from '@/components/ui-custom/DensityProvider'
import { OfflineIndicator } from '@/components/ui-custom/OfflineIndicator'
import { NotificationsProvider } from '@/components/ui-custom/NotificationsProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Energie CRM',
  description: 'CRM für Strom- und Gasvertrieb',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body className={inter.className}>
        <DensityProvider>
          <TooltipProvider delayDuration={100}>
            <NotificationsProvider>
              {children}
              <OfflineIndicator />
              <SonnerToaster richColors closeButton position="top-right" />
            </NotificationsProvider>
          </TooltipProvider>
        </DensityProvider>
      </body>
    </html>
  )
}
