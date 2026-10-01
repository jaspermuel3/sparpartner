'use client'

import type { ReactNode, MouseEvent } from 'react'
import { phoneHref } from '@/lib/constants'

export function PhoneLink({
  phone,
  className,
  children,
}: {
  phone: string | null | undefined
  className?: string
  children?: ReactNode
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
      className={cn('text-left', className ?? 'hover:underline')}
    >
      {children}
    </button>
  )
}

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}
