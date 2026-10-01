import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const twMerge = extendTailwindMerge()

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function buildQueryString(
  base: Record<string, string | string[] | undefined | null>,
  overrides?: Record<string, string | number | undefined | null>,
): string {
  const params = new URLSearchParams()
  const all: Record<string, string> = {}
  for (const [k, v] of Object.entries(base)) {
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) {
      const joined = v.filter(Boolean).join(',')
      if (joined) all[k] = joined
    } else {
      if (String(v).length > 0) all[k] = String(v)
    }
  }
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === null) {
      delete all[k]
      } else if (String(v).length === 0) {
        delete all[k]
      } else {
        all[k] = String(v)
      }
    }
  }
  for (const [k, v] of Object.entries(all)) params.set(k, v)
  const s = params.toString()
  return s ? `?${s}` : ''
}
