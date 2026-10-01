import { createAdminClient } from '../supabase/admin'
import type { PeriodType, SellerTarget, TargetType } from '@/types'

const DEFAULT_TARGETS: Array<{ period_type: PeriodType; target_type: TargetType; default_value: number }> = [
  { period_type: 'day', target_type: 'abschluesse', default_value: 3 },
  { period_type: 'day', target_type: 'leads', default_value: 10 },
  { period_type: 'day', target_type: 'kontaktquote', default_value: 70 },
  { period_type: 'month', target_type: 'abschluesse', default_value: 40 },
]

function dayLabel(d: Date = new Date()) {
  return d.toISOString().slice(0, 10)
}

function monthLabel(d: Date = new Date()) {
  return d.toISOString().slice(0, 7)
}

function weekLabel(d: Date = new Date()) {
  const tmp = new Date(d)
  const day = (tmp.getDay() + 6) % 7
  tmp.setDate(tmp.getDate() - day)
  return tmp.toISOString().slice(0, 10)
}

export function labelForPeriod(p: PeriodType, d: Date = new Date()): string {
  if (p === 'day') return dayLabel(d)
  if (p === 'week') return weekLabel(d)
  return monthLabel(d)
}

export async function ensureDefaultTargets(userId: string): Promise<SellerTarget[]> {
  const admin = createAdminClient()
  const periodLabels = {
    day: dayLabel(),
    week: weekLabel(),
    month: monthLabel(),
  }
  const toInsert: any[] = []
  for (const t of DEFAULT_TARGETS) {
    toInsert.push({
      user_id: userId,
      period_type: t.period_type,
      period_label: periodLabels[t.period_type],
      target_type: t.target_type,
      target_value: t.default_value,
    })
  }
  await admin.from('seller_targets').upsert(toInsert, {
    onConflict: 'user_id, period_type, period_label, target_type',
    ignoreDuplicates: true,
  })
  return getTargets(userId)
}

export async function getTargets(userId: string): Promise<SellerTarget[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('seller_targets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []) as SellerTarget[]
}

export async function setTarget(
  userId: string,
  period: PeriodType,
  type: TargetType,
  value: number,
): Promise<SellerTarget> {
  const admin = createAdminClient()
  const period_label = labelForPeriod(period)
  const payload = {
    user_id: userId,
    period_type: period,
    period_label,
    target_type: type,
    target_value: value,
  }
  const { data } = await admin
    .from('seller_targets')
    .upsert(payload, { onConflict: 'user_id, period_type, period_label, target_type' })
    .select()
    .limit(1)
    .maybeSingle()
  return data as SellerTarget
}
