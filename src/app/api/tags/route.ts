import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireUser()
    const admin = createAdminClient()
    const { data } = await admin
      .from('tags')
      .select('id, name, color')
      .order('name', { ascending: true })
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json([])
  }
}
