'use client'
import { useDensity } from '@/hooks/useDensity'

export function DensitySelector() {
  const { density, setDensity } = useDensity()
  return (
    <div className="space-y-2" role="radiogroup">
      {(['compact', 'normal', 'spacious'] as const).map((d) => (
        <label
          key={d}
          className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 min-h-[44px]"
        >
          <input
            type="radio"
            name="density"
            value={d}
            checked={density === d}
            onChange={() => setDensity(d)}
          />
          <span className="capitalize text-sm font-medium text-slate-800">
            {d === 'compact' ? 'Kompakt' : d === 'normal' ? 'Standard' : 'Geräumig'}
          </span>
          <span className="ml-auto text-[11px] text-slate-500">
            {d === 'compact'
              ? 'Mehr Zeilen sichtbar'
              : d === 'normal'
                ? 'Ausgewogene Darstellung'
                : 'Große Abstände'}
          </span>
        </label>
      ))}
    </div>
  )
}
