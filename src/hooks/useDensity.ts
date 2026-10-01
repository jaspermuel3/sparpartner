'use client'

import { useCallback, useEffect, useState } from 'react'

export type Density = 'compact' | 'normal' | 'spacious'
const STORAGE_KEY = 'crm:density'
const DEFAULT: Density = 'normal'

function readInitial(): Density {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'compact' || v === 'normal' || v === 'spacious') return v
  } catch {
    /* noop */
  }
  return DEFAULT
}

export function useDensity() {
  const [density, setDensity] = useState<Density>(readInitial)

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-density', density)
      document.documentElement.style.setProperty('--density-card-padding', density === 'compact' ? '12px' : density === 'spacious' ? '24px' : '18px')
      document.documentElement.style.setProperty('--density-cell-padding', density === 'compact' ? '6px 10px' : density === 'spacious' ? '14px 16px' : '10px 12px')
      document.documentElement.style.setProperty('--density-text-size', density === 'compact' ? '0.8rem' : density === 'spacious' ? '0.95rem' : '0.875rem')
      window.localStorage.setItem(STORAGE_KEY, density)
    } catch {
      /* noop */
    }
  }, [density])

  const toggle = useCallback((next?: Density) => {
    setDensity((cur) => {
      if (next) return next
      const order: Density[] = ['compact', 'normal', 'spacious']
      return order[(order.indexOf(cur) + 1) % order.length]
    })
  }, [])

  return { density, setDensity, toggle }
}
