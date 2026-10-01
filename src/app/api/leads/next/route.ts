import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type LeadRow = {
  id: string
  assigned_user_id: string | null
  status: string
  created_at: string
  lead_age_days?: string
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const skipId = searchParams.get('skip') || null

    const admin = (await import('@/lib/supabase/admin')).createAdminClient()

    let query = admin
      .from('leads')
      .select('id, assigned_user_id, status, created_at, lead_age_days:created_at')
      .eq('assigned_user_id', user.id)
      .not('status', 'in', '(closed,canceled,no_interest,wrong_data)')
      .order('created_at', { ascending: true })
      .limit(50)
    if (skipId) query = query.neq('id', skipId) as typeof query

    const { data: rawLeads } = await query
    const leads = (rawLeads ?? []) as LeadRow[]

    if (leads.length === 0) {
      return NextResponse.json({ id: null }, { status: 200 })
    }

    const { data: callbacks } = await admin
      .from('callbacks')
      .select('id, lead_id, callback_at, status')
      .eq('user_id', user.id)
      .eq('status', 'offen')
      .order('callback_at', { ascending: true })
      .limit(50)

    const leadIdToCallback = new Map<string, Date>()
    for (const cb of (callbacks ?? [] as Array<{ lead_id: string; callback_at: string }>)) {
      const d = new Date(cb.callback_at)
      if (!leadIdToCallback.has(cb.lead_id)) leadIdToCallback.set(cb.lead_id, d)
    }

    const leadIds = leads.map((l) => l.id)
    const { data: attempts } = await admin
      .from('contact_attempts')
      .select('lead_id')
      .in('lead_id', leadIds)
    const attemptCount = new Map<string, number>()
    for (const a of (attempts ?? [] as Array<{ lead_id: string }>)) {
      attemptCount.set(a.lead_id, (attemptCount.get(a.lead_id) ?? 0) + 1)
    }

    type Scored = { lead: LeadRow; score: number }
    const scored: Scored[] = leads.map((lead) => {
      let score = 0
      const cb = leadIdToCallback.get(lead.id)
      if (cb) {
        const mins = (Date.now() - cb.getTime()) / 60_000
        score += 10_000 + Math.max(0, mins)
      }
      if (lead.status === 'callback') score += 2000
      if (lead.status === 'offer') score += 1500
      if (lead.status === 'assigned') score += 1000
      if (lead.status === 'contacted') score += 800
      if (lead.status === 'new') score += 500
      const count = attemptCount.get(lead.id) ?? 0
      score += Math.max(0, 5 - count) * 20
      const ageHrs = Math.max(0, (Date.now() - new Date(lead.created_at).getTime()) / 3_600_000)
      score += ageHrs * 0.1
      return { lead, score }
    })
    scored.sort((a, b) => b.score - a.score)
    return NextResponse.json({ id: scored[0].lead.id, scored_count: scored.length })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 },
    )
  }
}
