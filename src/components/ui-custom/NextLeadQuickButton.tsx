'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function NextLeadQuickButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  async function goNext() {
    try {
      setLoading(true)
      const res = await fetch(`/api/leads/next`)
      if (!res.ok) {
        router.push('/request-lead')
        return
      }
      const data = await res.json()
      if (data?.id) router.push(`/leads/${data.id}`)
      else router.push('/request-lead')
    } catch {
      router.push('/request-lead')
    } finally {
      setLoading(false)
    }
  }
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={goNext}
          disabled={loading}
          className="inline-flex h-9 items-center gap-1 rounded-lg bg-gradient-to-br from-sky-600 to-indigo-600 px-3 text-xs font-semibold text-white shadow-sm hover:from-sky-700 hover:to-indigo-700 disabled:opacity-60 transition"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <span>Nächster Lead</span>
          {!loading && <ChevronRight className="h-3.5 w-3.5 -ml-1" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        <span className="text-[11px] font-medium">Nächsten Prioritäts-Lead automatisch öffnen</span>
      </TooltipContent>
    </Tooltip>
  )
}
