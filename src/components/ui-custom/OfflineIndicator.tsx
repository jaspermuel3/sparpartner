'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function OfflineIndicator() {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [toastShown, setToastShown] = useState(false)

  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      toast.success('Wieder online', { description: 'Alle Änderungen werden jetzt sofort gespeichert.' })
    }
    const onOffline = () => {
      setOnline(false)
      if (!toastShown) {
        toast.warning('Keine Internetverbindung', {
          description: 'Formulare werden deaktiviert, bis du wieder online bist.',
          duration: 5000,
        })
        setToastShown(true)
      }
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [toastShown])

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-online', online ? '1' : '0')
      if (online) {
        const inputs = document.querySelectorAll<HTMLInputElement | HTMLButtonElement>('[data-disabled-offline]')
        inputs.forEach((el) => el.removeAttribute('disabled'))
      } else {
        const inputs = document.querySelectorAll<HTMLInputElement | HTMLButtonElement>('[data-disabled-offline]')
        inputs.forEach((el) => el.setAttribute('disabled', 'true'))
      }
    } catch {
      /* noop */
    }
  }, [online])

  if (online) return null

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 z-[60] inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 shadow-lg backdrop-blur',
      )}
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden />
      <span className="hidden sm:inline">Offline · Änderungen werden gespeichert, sobald du online bist</span>
      <span className="sm:hidden">Offline</span>
      <Wifi className="ml-1 h-3.5 w-3.5 animate-pulse text-amber-500" aria-hidden />
    </div>
  )
}
