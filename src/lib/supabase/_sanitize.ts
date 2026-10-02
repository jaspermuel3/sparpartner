/* ============================================================
   Kompatibilitäts-Wrapper.

   Alle neuen Komponenten sollten direkt `src/lib/env.ts`
   verwenden. Diese Datei bleibt bestehen, damit bestehende
   Imports nicht brechen.
   ============================================================ */

import {
  getSupabaseUrl as envUrl,
  getSupabaseAnonKey as envAnon,
  getSupabaseServiceRoleKey as envService,
} from '../env'

export function stripBomAndWs(v: string | null | undefined): string {
  if (v === undefined || v === null) return ''
  let s = String(v)
  if (s.length === 0) return s
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
  return s.replace(/[\u200b-\u200f\ufeff\ufffe]/g, '').trim()
}

/* ---------- Delegation an env.ts (Validierung ist dort zentral) ---------- */
export const getSupabaseUrl = (): string => stripBomAndWs(envUrl())
export const getSupabaseAnonKey = (): string => stripBomAndWs(envAnon())
export const getSupabaseServiceRoleKey = (): string => stripBomAndWs(envService())
