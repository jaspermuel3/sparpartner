import { createAdminClient } from '../supabase/admin'
import { logAudit } from '../audit'
import type { DatabaseUser, UserRole, TokenTransactionType } from '@/types'
import { getUserEmailMap, withEmail } from '../user-emails'

export async function creditTokens(
  targetUserId: string,
  amount: number,
  reason: string,
  createdBy: string,
  type: 'aufladung' | 'rueckerstattung' | 'korrektur_plus' = 'aufladung',
) {
  if (amount <= 0) throw new Error('AMOUNT_MUST_BE_POSITIVE')
  const admin = createAdminClient()

  const { data, error } = await admin.rpc('credit_tokens', {
    p_target_user_id: targetUserId,
    p_amount: amount,
    p_reason: reason,
    p_type: type as TokenTransactionType,
    p_created_by: createdBy,
  })
  if (error) {
    if (['WALLET_NOT_FOUND', 'AMOUNT_MUST_BE_POSITIVE'].includes(error.message)) {
      throw new Error(error.message)
    }
    throw error
  }
  const newBalance = data as number
  const { data: wallet } = await admin.from('token_wallets').select('id').eq('user_id', targetUserId).maybeSingle()
  if (wallet) {
    await logAudit(createdBy, 'TOKEN_CREDIT', 'token_wallet', (wallet as any).id, {
      target_user: targetUserId,
      amount,
      reason,
    })
  }
  return { balance: newBalance }
}

export async function debitTokens(
  targetUserId: string,
  amount: number,
  reason: string,
  createdBy: string,
  type: 'korrektur_minus' = 'korrektur_minus',
) {
  if (amount <= 0) throw new Error('AMOUNT_MUST_BE_POSITIVE')
  const admin = createAdminClient()

  const { data, error } = await admin.rpc('debit_tokens', {
    p_target_user_id: targetUserId,
    p_amount: amount,
    p_reason: reason,
    p_type: type as TokenTransactionType,
    p_created_by: createdBy,
  })
  if (error) {
    if (['WALLET_NOT_FOUND', 'NOT_ENOUGH_TOKENS', 'AMOUNT_MUST_BE_POSITIVE'].includes(error.message)) {
      throw new Error(error.message)
    }
    throw error
  }
  const newBalance = data as number
  const { data: wallet } = await admin.from('token_wallets').select('id').eq('user_id', targetUserId).maybeSingle()
  if (wallet) {
    await logAudit(createdBy, 'TOKEN_DEBIT', 'token_wallet', (wallet as any).id, {
      target_user: targetUserId,
      amount,
      reason,
    })
  }
  return { balance: newBalance }
}

export async function getTokenWallet(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('token_wallets')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  return data
}

export async function getTokenTransactions(userId: string, limit = 100) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('token_transactions')
    .select(`*, created_by_user:users!token_transactions_created_by_fkey(full_name)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getAllWalletsWithUser() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('token_wallets')
    .select(`*, user:users(id, full_name, is_active, role)`)
    .order('user_id')
  const rows = (data ?? []) as any[]
  if (!rows.length) return rows
  const userIds = rows.filter((r: any) => r.user?.id).map((r: any) => r.user.id as string)
  const emailMap = await getUserEmailMap(userIds)
  return rows.map((r) => withEmail(r, emailMap, 'user'))
}

export async function getAllTransactions(limit = 500) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('token_transactions')
    .select(`
      *,
      user:users(id, full_name),
      created_by_user:users!token_transactions_created_by_fkey(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)
  const rows = (data ?? []) as any[]
  if (!rows.length) return rows
  const userIds = rows.filter((r: any) => r.user?.id).map((r: any) => r.user.id as string)
  const emailMap = await getUserEmailMap(userIds)
  return rows.map((r) => withEmail(r, emailMap, 'user'))
}
