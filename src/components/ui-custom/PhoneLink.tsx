'use client'

import type { ReactNode } from 'react'
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
  return (
    <a
      href={phoneHref(phone)}
      onClick={(e) => e.stopPropagation()}
      className={className ?? 'hover:underline'}
    >
      {children}
    </a>
  )
}
