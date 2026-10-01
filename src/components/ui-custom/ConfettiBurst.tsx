'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

type ConfettiBurstProps = {
  active: boolean
  durationMs?: number
  pieceCount?: number
  className?: string
  onDone?: () => void
}

const PALETTE = [
  '#0ea5e9',
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
]

export function ConfettiBurst({
  active,
  durationMs = 2200,
  pieceCount = 48,
  className,
  onDone,
}: ConfettiBurstProps) {
  const [show, setShow] = useState(false)
  const pieces = useMemo(() => {
    return Array.from({ length: pieceCount }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / pieceCount + Math.random() * 0.4
      const dist = 90 + Math.random() * 150
      const dx = Math.cos(angle) * dist
      const dy = Math.sin(angle) * dist - 40
      const size = 6 + Math.random() * 8
      const rot = (Math.random() - 0.5) * 540
      const delay = Math.random() * 60
      const dur = 900 + Math.random() * 700
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)]
      const shape = Math.random() > 0.5 ? 'rounded-sm' : 'rounded-full'
      return { dx, dy, size, rot, delay, dur, color, shape, key: i }
    })
  }, [pieceCount])

  useEffect(() => {
    if (!active) return
    setShow(true)
    const t = window.setTimeout(() => {
      setShow(false)
      onDone?.()
    }, durationMs)
    return () => window.clearTimeout(t)
  }, [active, durationMs, onDone])

  if (!show) return null

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none fixed inset-0 z-[120] flex items-center justify-center', className)}
    >
      {pieces.map((p) => (
        <span
          key={p.key}
          className={cn('absolute left-1/2 top-1/2', p.shape)}
          style={{
            width: p.size,
            height: p.size * 0.55,
            backgroundColor: p.color,
            animation: `confetti-burst ${p.dur}ms cubic-bezier(0.16, 1, 0.3, 1) ${p.delay}ms both`,
            ['--dx' as any]: `${p.dx}px`,
            ['--dy' as any]: `${p.dy}px`,
            ['--rot' as any]: `${p.rot}deg`,
            opacity: 0.95,
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          }}
        />
      ))}
    </div>
  )
}
