'use client'

import { createContext, useContext } from 'react'
import { useDensity, type Density } from '@/hooks/useDensity'

const DensityCtx = createContext<{
  density: Density
  setDensity: (d: Density) => void
  toggle: (n?: Density) => void
} | null>(null)

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const d = useDensity()
  return <DensityCtx.Provider value={d}>{children}</DensityCtx.Provider>
}

export function useDensityContext() {
  const v = useContext(DensityCtx)
  if (!v) throw new Error('useDensityContext must be used inside DensityProvider')
  return v
}
