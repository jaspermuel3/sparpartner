'use client'

import type { MouseEvent } from 'react'
import { Phone } from 'lucide-react'
import { phoneHref } from '@/lib/constants'

export function CallButton({
  phone,
  label,
  showIcon = true,
  className,
}: {
  phone: string | null | undefined
  label?: string
  showIcon?: boolean
  className?: string
}) {
  if (!phone) return null
  const href = phoneHref(phone)
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    e.preventDefault()
    window.location.href = href
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      aria-label={label ?? 'Anrufen'}
    >
      {showIcon && <Phone className={label ? 'mr-1.5 h-4 w-4' : 'h-4 w-4'} />}
      {label && <span>{label}</span>}
    </button>
  )
}
