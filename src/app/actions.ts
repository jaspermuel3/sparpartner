'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser, requireAdmin, requireSeller } from '@/lib/auth'
import { runLoginFlow } from '@/lib/auth-login'
import { validateLeadField, validatePasswordPolicy } from '@/lib/validation'
import { log, tryLog } from '@/lib/logging'
import {
  requestLead,
  updateLeadStatus as svcUpdateLeadStatus,
  updateLeadNotes as svcUpdateLeadNotes,
  addContactAttempt as svcAddContactAttempt,
  createCallback as svcCreateCallback,
  updateCallbackStatus as svcUpdateCallbackStatus,
  getLeadWithDetails,
  addToWaitlist as svcAddToWaitlist,
  removeFromWaitlist as svcRemoveFromWaitlist,
} from '@/lib/services/leads.service'
import type { ProductType } from '@/types'
import {
  creditTokens as svcCreditTokens,
  debitTokens as svcDebitTokens,
} from '@/lib/services/tokens.service'
import {
  createSeller as svcCreateSeller,
  updateSeller as svcUpdateSeller,
  resetSellerPassword as svcResetSellerPassword,
  adminAssignLeadToSeller,
  adminResetLead,
  adminCreateLead,
  toggleLeadHold,
  createCampaign,
  updateCampaign,
  adminSoftDeleteLead,
  requestCancellation as svcRequestCancellation,
  reviewCancellation as svcReviewCancellation,
  softDeleteSeller as svcSoftDeleteSeller,
  restoreSeller as svcRestoreSeller,
  updateSellerEmail as svcUpdateSellerEmail,
  generateUserMagicLink as svcGenerateMagicLink,
  toggleSellerActiveWithReason as svcToggleActiveReason,
  bulkDeactivateSellers as svcBulkDeactivate,
} from '@/lib/services/admin.service'
import { logAudit } from '@/lib/audit'
import {
  notifyLeadAssigned,
  notifyTokenCredit,
  notifyTokenLow,
  notifyLeadAvailable,
  notifyCallbackDue,
} from '@/lib/services/notifications.service'
import {
  getNotifications as svcGetNotifications,
  getUnreadCount as svcUnreadCount,
  markNotificationRead as svcMarkRead,
  markAllNotificationsRead as svcMarkAllRead,
} from '@/lib/services/notifications.service'

const mapError = (err: unknown): { error: string } => {
  let msg: string
  if (err instanceof Error) {
    msg = err.message
  } else if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string') {
    msg = (err as any).message
  } else {
    try {
      msg = typeof err === 'string' ? err : JSON.stringify(err)
    } catch {
      msg = String(err)
    }
    if (msg === '[object Object]') msg = 'Unbekannter Fehler.'
  }
  const map: Record<string, string> = {
    NOT_ENOUGH_TOKENS: 'Nicht genügend Tokens.',
    NO_LEAD_AVAILABLE: 'Aktuell ist kein Lead verfügbar. Du kannst dich auf die Warteliste setzen lassen.',
    NO_WALLET: 'Token-Wallet nicht gefunden.',
    WALLET_NOT_FOUND: 'Token-Wallet nicht gefunden.',
    UNAUTHENTICATED: 'Bitte melde dich erneut an.',
    FORBIDDEN: 'Zugriff verweigert.',
    USER_INACTIVE: 'Dein Account ist deaktiviert.',
    LEAD_NOT_FOUND: 'Lead nicht gefunden.',
    ALREADY_ASSIGNED: 'Lead ist bereits zugewiesen.',
    AMOUNT_MUST_BE_POSITIVE: 'Betrag muss größer 0 sein.',
    AUTH_CREATE_FAILED: 'Benutzer konnte nicht erstellt werden. (E-Mail evtl. bereits registriert?)',
    WAITLIST_INSERT_FAILED: 'Konnte nicht zur Warteliste hinzugefügt werden.',
    NOT_YOUR_LEAD: 'Dieser Lead gehört dir nicht.',
    ALREADY_REQUESTED: 'Für diesen Lead läuft bereits eine Stornierungsanfrage.',
    REQUEST_NOT_FOUND: 'Anfrage nicht gefunden.',
    ALREADY_REVIEWED: 'Anfrage wurde bereits bearbeitet.',
    LAST_ADMIN_PROTECTED: 'Dies ist der letzte aktive Admin – Mindestens ein Admin muss aktiv bleiben.',
    CANNOT_DELETE_SELF: 'Du kannst dich nicht selbst löschen oder deaktivieren.',
    INVALID_EMAIL: 'Ungültige E-Mail-Adresse.',
    FULLNAME_INVALID: 'Name muss mindestens 2 Zeichen lang sein.',
    EMAIL_ALREADY_EXISTS: 'Diese E-Mail wird bereits verwendet.',
    USER_EMAIL_NOT_FOUND: 'Benutzer hat keine hinterlegte E-Mail.',
    inactive: 'Dein Account ist deaktiviert. Bitte kontaktiere den Administrator.',
    ZU_VIELE_VERSUCHE: 'Zu viele fehlgeschlagene Versuche. Bitte warte ein paar Minuten.',
  }
  const base = map[msg]
  if (base) return { error: base }
  if (msg.startsWith('MAINTENANCE_MODE:')) {
    const info = msg.replace('MAINTENANCE_MODE:', '').trim() || 'Wartungsarbeiten.'
    return { error: 'Wartungsmodus aktiv: ' + info }
  }
  if (msg.startsWith('PASSWORT_SCHWACH:')) {
    return { error: msg.replace('PASSWORT_SCHWACH:', 'Passwort zu schwach:').trim() }
  }
  return { error: msg }
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '/dashboard')

  try {
    const res = await runLoginFlow({
      email,
      password,
      next,
      createSupabase: createClient,
      validateBeforeSignIn: false,
    })
    if (!res.ok || !res.user || !res.nextOverride) {
      return { error: res.error?.message ?? 'Anmeldung fehlgeschlagen.' }
    }
    const admin = createAdminClient()
    await tryLog('AUTH', undefined, async () => {
      await admin.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', res.user!.db_id)
    }, 'last_login_at Update via loginAction')
    return { redirectTo: res.nextOverride }
  } catch (err) {
    return mapError(err)
  }
}

export async function logoutAction(formData?: FormData) {
  const supabase = createClient()
  try {
    await supabase.auth.signOut()
  } catch (e) {
    log.warn('AUTH', 'SignOut (logoutAction) fehlgeschlagen (swallowed, weiterleitung läuft)', undefined, e)
  }
  return { redirectTo: '/login' }
}

export async function requestLeadAction(formData: FormData) {
  try {
    const user = await requireSeller()
    const rawProduct = formData.get('product')?.toString()
    const product: ProductType | null =
      rawProduct === 'strom' || rawProduct === 'gas' || rawProduct === 'beides' ? rawProduct : null
    const lead = await requestLead(user.id, product)
    await logAudit(user.id, 'LEAD_ASSIGNED', 'lead', lead.id, { via: 'request_lead', product })
    await logAudit(user.id, 'TOKEN_DEBIT', 'token_wallet', null, { amount: -1, lead_id: lead.id })
    await tryLog('ACTIONS', undefined, () => svcRemoveFromWaitlist(user.id), 'svcRemoveFromWaitlist failed, swallowed')
    try {
      const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unbekannt'
      await notifyLeadAssigned(user.id, lead.id, leadName)
      const { getWalletBalance } = await import('@/lib/services/tokens.service')
      const bal = await getWalletBalance(user.id)
      await notifyTokenLow(user.id, bal)
    } catch (e) {
      log.warn('ACTIONS', 'Benachrichtigungen nach Lead-Zuweisung fehlgeschlagen', { lead_id: lead.id }, e)
    }
    revalidatePath('/dashboard')
    revalidatePath('/my-leads')
    revalidatePath('/request-lead')
    return {
      ok: true,
      leadAssigned: true,
      redirectTo: `/leads/${lead.id}`,
      toast: {
        title: 'Lead zugewiesen',
        description: 'Du wirst direkt zur Lead-Detailseite weitergeleitet.',
        variant: 'success' as const,
      },
    }
  } catch (err) {
    return mapError(err)
  }
}

export async function joinWaitlistAction(formData: FormData) {
  try {
    const user = await requireSeller()
    const rawProduct = formData.get('product')?.toString()
    const product: ProductType | null =
      rawProduct === 'strom' || rawProduct === 'gas' || rawProduct === 'beides' ? rawProduct : null
    await svcAddToWaitlist(user.id, product)
    await logAudit(user.id, 'LEAD_CREATED', 'lead_waitlist', null, { action: 'join', product })
    revalidatePath('/request-lead')
    return {
      ok: true,
      waitlistJoined: true,
      toast: {
        title: 'Auf Warteliste gesetzt',
        description: product
          ? `Du wirst benachrichtigt, sobald ein Lead für "${product}" verfügbar ist.`
          : 'Du wirst benachrichtigt, sobald ein Lead verfügbar ist.',
        variant: 'success' as const,
      },
    }
  } catch (err) {
    return mapError(err)
  }
}

export async function leaveWaitlistAction() {
  try {
    const user = await requireSeller()
    await svcRemoveFromWaitlist(user.id)
    revalidatePath('/request-lead')
    return {
      ok: true,
      toast: {
        title: 'Von Warteliste entfernt',
        variant: 'default' as const,
      },
    }
  } catch (err) {
    return mapError(err)
  }
}

export async function getAvailableLeadCountsAction() {
  try {
    await requireSeller()
    const { getAvailableLeadCountBreakdown } = await import('@/lib/services/leads.service')
    const breakdown = await getAvailableLeadCountBreakdown()
    return { ok: true as const, breakdown }
  } catch (err) {
    return { ok: false as const, ...mapError(err) }
  }
}

export async function updateLeadStatusAction(formData: FormData) {
  try {
    const leadId = String(formData.get('leadId'))
    const status = String(formData.get('status')) as any
    const user = await requireUser()
    await getLeadWithDetails(leadId, user.id, user.role)
    await svcUpdateLeadStatus(leadId, status, user.id, user.role)
    revalidatePath(`/leads/${leadId}`)
    revalidatePath('/my-leads')
    revalidatePath('/dashboard')
    revalidatePath('/admin/leads')
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

export async function updateLeadNotesAction(formData: FormData) {
  try {
    const leadId = String(formData.get('leadId'))
    const notes = String(formData.get('notes') ?? '')
    const user = await requireUser()
    await svcUpdateLeadNotes(leadId, notes, user.id, user.role)
    revalidatePath(`/leads/${leadId}`)
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

export async function updateLeadInlineAction(formData: FormData) {
  try {
    const leadId = String(formData.get('leadId'))
    const field = String(formData.get('field') ?? '')
    const rawValue = String(formData.get('value') ?? '')
    const user = await requireUser()
    const allowedFields = ['first_name', 'last_name', 'phone', 'email', 'notes', 'street', 'zip', 'city']
    if (!allowedFields.includes(field)) return { error: 'Ungültiges Feld.' }

    // ---------- Validierung (selbe Strenge wie Public-API) ----------
    const check = validateLeadField(field, rawValue)
    if (!check.ok) {
      const firstErr = Object.values(check.errors ?? { _: 'Ungültige Eingabe.' })[0]
      return { error: firstErr }
    }
    const normalized =
      check.normalized === undefined
        ? rawValue
        : (check.normalized as unknown as string)

    await getLeadWithDetails(leadId, user.id, user.role)
    const admin = createAdminClient()
    const patch: any = {}
    if (field === 'phone' || field === 'email' || field === 'street' || field === 'city') {
      patch[field] = normalized === '' ? null : normalized
    } else if (field === 'zip') {
      patch.zip = normalized === '' ? null : normalized
    } else if (field === 'notes') {
      patch.notes = rawValue
    } else {
      patch[field] = normalized ?? rawValue
    }
    const { error } = await admin.from('leads').update(patch).eq('id', leadId)
    if (error) throw error
    await logAudit(user.id, 'LEAD_UPDATED', 'lead', leadId, { field, value: normalized ?? rawValue })
    revalidatePath(`/leads/${leadId}`)
    revalidatePath('/my-leads')
    revalidatePath('/admin/leads')
    return { ok: true, saveLabel: `${field} aktualisiert` }
  } catch (err) {
    return mapError(err)
  }
}

export async function addContactAttemptAction(formData: FormData) {
  try {
    const leadId = String(formData.get('leadId'))
    const result = String(formData.get('result')) as any
    const dateInput = String(formData.get('date'))
    const timeInput = String(formData.get('time'))
    const notes = String(formData.get('notes') ?? '') || null
    const callDurationRaw = formData.get('call_duration_seconds')
    let callDurationSeconds: number | null = null
    if (callDurationRaw !== null && callDurationRaw !== undefined && callDurationRaw !== '') {
      const v = Number(callDurationRaw)
      if (!Number.isNaN(v) && v > 0) callDurationSeconds = Math.max(0, Math.round(v))
    }

    const iso = new Date(`${dateInput}T${timeInput}:00`).toISOString()
    const user = await requireUser()
    await svcAddContactAttempt({
      lead_id: leadId,
      user_id: user.id,
      attempt_date: iso,
      result,
      notes,
      call_duration_seconds: callDurationSeconds,
    })
    revalidatePath(`/leads/${leadId}`)
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

export async function createCallbackAction(formData: FormData) {
  try {
    const leadId = String(formData.get('leadId'))
    const dateInput = String(formData.get('date'))
    const timeInput = String(formData.get('time'))
    const notes = String(formData.get('notes') ?? '') || null

    const iso = new Date(`${dateInput}T${timeInput}:00`).toISOString()
    const user = await requireUser()
    await svcCreateCallback({
      lead_id: leadId,
      user_id: user.id,
      callback_at: iso,
      notes,
    })
    revalidatePath(`/leads/${leadId}`)
    revalidatePath('/dashboard')
    revalidatePath('/callbacks')
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

export async function updateCallbackStatusAction(formData: FormData) {
  try {
    const id = String(formData.get('callbackId'))
    const status = String(formData.get('status')) as any
    const user = await requireUser()
    await svcUpdateCallbackStatus(id, status, user.id)
    revalidatePath('/dashboard')
    revalidatePath('/callbacks')
    revalidatePath(`/leads/${formData.get('leadId') ?? ''}`)
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

// ADMIN ACTIONS

export async function createSellerAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const email = String(formData.get('email'))
    const passwordRaw = formData.get('password')
    const password = passwordRaw ? String(passwordRaw) : undefined
    const full_name = String(formData.get('full_name'))
    const initial_balance_raw = Number(formData.get('initial_balance') ?? 0) || 0
    const role_raw = formData.get('role') ? String(formData.get('role')) : 'seller'
    const role = role_raw === 'admin' ? 'admin' : 'seller'

    if (password !== undefined && password.length > 0) {
      const pw = validatePasswordPolicy(password)
      if (!pw.ok) {
        return { error: 'PASSWORT_SCHWACH:' + pw.errors.join(' ') }
      }
    }
    if (full_name.trim().length < 2) return { error: 'Name muss mindestens 2 Zeichen lang sein.' }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Ungültige E-Mail-Adresse.' }

    const res = await svcCreateSeller(
      { email, password, full_name, initial_balance: initial_balance_raw, role },
      adminUser.id,
    )
    revalidatePath('/admin/sellers')
    return { ok: true, userId: res.userId }
  } catch (err) {
    return mapError(err)
  }
}

export async function updateSellerAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const userId = String(formData.get('userId'))
    const full_name_raw = formData.get('full_name')
    const phone_raw = formData.get('phone')
    const notes_raw = formData.get('notes')
    const role_raw = formData.get('role') ? String(formData.get('role')) : null
    const reason = formData.get('reason') ? String(formData.get('reason')) : undefined

    const patch: any = {}
    if (full_name_raw !== null && full_name_raw !== undefined) {
      const f = String(full_name_raw).trim()
      if (f.length) patch.full_name = f
    }
    if (phone_raw !== null && phone_raw !== undefined) {
      const p = String(phone_raw).trim()
      patch.phone = p.length ? p : null
    }
    if (notes_raw !== null && notes_raw !== undefined) {
      const n = String(notes_raw).trim()
      patch.notes = n.length ? n : null
    }
    if (role_raw === 'admin' || role_raw === 'seller') patch.role = role_raw
    await svcUpdateSeller(userId, patch, adminUser.id, reason)
    revalidatePath('/admin/sellers')
    revalidatePath(`/admin/sellers/${userId}`)
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

export async function toggleSellerActiveAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const userId = String(formData.get('userId'))
    const setActive = formData.get('active') === 'true'
    const reason = formData.get('reason') ? String(formData.get('reason')) : ''
    await svcToggleActiveReason(userId, adminUser.id, setActive, reason)
    revalidatePath('/admin/sellers')
    revalidatePath(`/admin/sellers/${userId}`)
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

export async function resetSellerPasswordAction(formData: FormData) {
  try {
    await requireAdmin()
    const userId = String(formData.get('userId'))
    const password = String(formData.get('password'))
    const pw = validatePasswordPolicy(password)
    if (!pw.ok) {
      return { error: 'PASSWORT_SCHWACH:' + pw.errors.join(' ') }
    }
    await svcResetSellerPassword(userId, password)
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

export async function addTokensToSellerAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const userId = String(formData.get('userId'))
    const amount = Number(formData.get('amount'))
    const reason = String(formData.get('reason'))
    const type = (String(formData.get('type') ?? 'aufladung')) as any
    await svcCreditTokens(userId, amount, reason, adminUser.id, type)
    try {
      const { getWalletBalance } = await import('@/lib/services/tokens.service')
      const bal = await getWalletBalance(userId)
      await notifyTokenCredit(userId, amount, bal, reason)
      await notifyTokenLow(userId, bal)
    } catch (e) {
      log.warn('ACTIONS', 'addTokensToSellerAction Benachrichtigungen fehlgeschlagen', { user_id: userId }, e)
    }
    revalidatePath('/admin/sellers')
    revalidatePath('/admin/tokens')
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

export async function subtractTokensFromSellerAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const userId = String(formData.get('userId'))
    const amount = Number(formData.get('amount'))
    const reason = String(formData.get('reason'))
    await svcDebitTokens(userId, amount, reason, adminUser.id, 'korrektur_minus')
    try {
      const { getWalletBalance } = await import('@/lib/services/tokens.service')
      const bal = await getWalletBalance(userId)
      await notifyTokenLow(userId, bal)
    } catch (e) {
      log.warn('ACTIONS', 'subtractTokensFromSellerAction Benachrichtigungen fehlgeschlagen', { user_id: userId }, e)
    }
    revalidatePath('/admin/sellers')
    revalidatePath('/admin/tokens')
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

export async function adminAssignLeadAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const leadId = String(formData.get('leadId'))
    const sellerId = String(formData.get('sellerId'))
    const debitTokens = formData.get('debitTokens') === 'on' || formData.get('debitTokens') === 'true'
    await adminAssignLeadToSeller(leadId, sellerId, adminUser.id, debitTokens)
    try {
      const lead = await getLeadWithDetails(leadId, adminUser.id, 'admin')
      const leadName = lead
        ? [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unbekannt'
        : 'Unbekannt'
      await notifyLeadAssigned(sellerId, leadId, leadName)
      const { getWalletBalance } = await import('@/lib/services/tokens.service')
      const bal = await getWalletBalance(sellerId)
      await notifyTokenLow(sellerId, bal)
    } catch (e) {
      log.warn('ACTIONS', 'adminAssignLeadAction Benachrichtigungen fehlgeschlagen', { lead_id: leadId, seller_id: sellerId }, e)
    }
    revalidatePath('/admin/leads')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

export async function adminResetLeadAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const leadId = String(formData.get('leadId'))
    const refund = formData.get('refund') !== 'false'
    await adminResetLead(leadId, adminUser.id, refund)
    revalidatePath('/admin/leads')
    revalidatePath('/admin/tokens')
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

export async function updateProfileAction(formData: FormData) {
  try {
    const user = await requireUser()
    const supabase = createClient()
    const full_name = String(formData.get('full_name') ?? '')
    const email = String(formData.get('email') ?? '')
    const password = String(formData.get('password') ?? '')
    const password_new = String(formData.get('password_new') ?? '')

    if (password && password_new) {
      const pwPolicy = validatePasswordPolicy(password_new)
      if (!pwPolicy.ok) {
        return { error: 'PASSWORT_SCHWACH:' + pwPolicy.errors.join(' ') }
      }
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: (user as any).auth_email ?? email, password })
      if (signInErr) return { error: 'Aktuelles Passwort ist falsch.' }
      const { error: updateErr } = await supabase.auth.updateUser({ password: password_new })
      if (updateErr) return { error: updateErr.message }
    }

    const patch: any = {}
    if (full_name) patch.full_name = full_name
    if (Object.keys(patch).length > 0) {
      const admin = createAdminClient()
      await admin.from('users').update(patch).eq('id', user.id)
    }
    revalidatePath('/settings')
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

/* =========================
   Lead Tags (#51)
   ========================= */

export async function assignTagToLeadAction(formData: FormData) {
  try {
    const user = await requireUser()
    const leadId = String(formData.get('leadId'))
    const tagId = String(formData.get('tagId'))
    // Check lead permission
    await getLeadWithDetails(leadId, user.id, user.role)
    const admin = createAdminClient()
    const { error } = await admin
      .from('lead_tags')
      .insert({ lead_id: leadId, tag_id: tagId })
    if (error && error.code !== '23505') throw error
    await logAudit(user.id, 'TAG_ASSIGNED', 'lead', leadId, { tag_id: tagId })
    revalidatePath(`/leads/${leadId}`)
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

export async function removeTagFromLeadAction(formData: FormData) {
  try {
    const user = await requireUser()
    const leadId = String(formData.get('leadId'))
    const tagId = String(formData.get('tagId'))
    await getLeadWithDetails(leadId, user.id, user.role)
    const admin = createAdminClient()
    await admin.from('lead_tags').delete().eq('lead_id', leadId).eq('tag_id', tagId)
    revalidatePath(`/leads/${leadId}`)
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

export async function createTagAction(formData: FormData) {
  try {
    const user = await requireUser()
    const name = String(formData.get('name') ?? '').trim()
    if (!name) return { error: 'Name ist erforderlich.' }
    const color = String(formData.get('color') ?? '#6366f1')
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('tags')
      .insert({ name, color, created_by: user.id })
      .select()
      .limit(1)
      .maybeSingle()
    if (error) {
      if (error.code === '23505') return { error: 'Ein Tag mit diesem Namen existiert bereits.' }
      throw error
    }
    revalidatePath('/leads')
    return { ok: true, tagId: (data as any)?.id }
  } catch (err) {
    return mapError(err)
  }
}

/* =========================
   Lead Documents (#46) – Einfache DB-Insert; Storage Upload muss nachgereicht werden.
   ========================= */

export async function addLeadDocumentAction(formData: FormData) {
  try {
    const user = await requireUser()
    const leadId = String(formData.get('leadId'))
    const fileName = String(formData.get('file_name') ?? '').trim() || 'Dokument'
    const size = Number(formData.get('size') ?? 0) || 0
    const mime = String(formData.get('mime_type') ?? '') || null
    await getLeadWithDetails(leadId, user.id, user.role)
    const admin = createAdminClient()
    const { error } = await admin.from('lead_documents').insert({
      lead_id: leadId,
      file_name: fileName,
      mime_type: mime,
      size_bytes: size > 0 ? size : null,
      storage_path: `pending/${leadId}/${encodeURIComponent(fileName)}`,
      created_by: user.id,
    })
    if (error) throw error
    await logAudit(user.id, 'DOCUMENT_UPLOADED', 'lead', leadId, { file: fileName })
    revalidatePath(`/leads/${leadId}`)
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

export async function deleteLeadDocumentAction(formData: FormData) {
  try {
    const user = await requireUser()
    const leadId = String(formData.get('leadId'))
    const docId = String(formData.get('docId'))
    await getLeadWithDetails(leadId, user.id, user.role)
    const admin = createAdminClient()
    await admin.from('lead_documents').delete().eq('id', docId)
    revalidatePath(`/leads/${leadId}`)
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

/* =========================
   Notification Preferences (#101)
   ========================= */

export async function updateNotificationPrefsAction(formData: FormData) {
  try {
    const user = await requireUser()
    const admin = createAdminClient()
    const on_lead_assigned = formData.get('on_lead_assigned') === 'on'
    const on_callback_reminder = formData.get('on_callback_reminder') === 'on'
    const on_newsletter = formData.get('on_newsletter') === 'on'
    const desktop_enabled = formData.get('desktop_enabled') === 'on'

    await admin
      .from('notification_preferences')
      .upsert(
        {
          user_id: user.id,
          on_lead_assigned,
          on_callback_reminder,
          on_newsletter,
          desktop_enabled,
        },
        { onConflict: 'user_id' },
      )
    revalidatePath('/settings')
    return {
      ok: true,
      toast: { title: 'Einstellungen gespeichert', variant: 'success' as const },
    }
  } catch (err) { return mapError(err) }
}

/* ========= Batch I/K Admin Actions ========= */
export async function adminCreateLeadAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const input: any = {
      first_name: String(formData.get('first_name') ?? ''),
      last_name: String(formData.get('last_name') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      email: formData.get('email') ? String(formData.get('email')) : null,
      street: formData.get('street') ? String(formData.get('street')) : null,
      zip: formData.get('zip') ? String(formData.get('zip')) : null,
      city: formData.get('city') ? String(formData.get('city')) : null,
      product: String(formData.get('product') ?? 'strom') as any,
      source: String(formData.get('source') ?? 'manual') as any,
      campaign_id: formData.get('campaign_id') ? String(formData.get('campaign_id')) : null,
      power_consumption: formData.get('power_consumption'),
      gas_consumption: formData.get('gas_consumption'),
      notes: formData.get('notes') ? String(formData.get('notes')) : null,
    }
    if (!input.first_name || !input.last_name || !input.phone) return { error: 'Vorname, Nachname und Telefon sind erforderlich.' }
    const sellerId = formData.get('seller_id') ? String(formData.get('seller_id')) : undefined
    const debit = formData.get('debitTokens') === 'on' || formData.get('debitTokens') === 'true'
    const { id } = await adminCreateLead(input, adminUser.id, sellerId, debit)
    revalidatePath('/admin/leads')
    return { ok: true, toast: { title: 'Lead angelegt', description: `#${id.slice(0,8)}`, variant: 'success' as const } }
  } catch (err) { return mapError(err) }
}

export async function adminToggleHoldAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const leadId = String(formData.get('leadId'))
    const on = formData.get('is_on_hold') === 'on' || formData.get('is_on_hold') === 'true'
    const notes = formData.get('hold_notes') ? String(formData.get('hold_notes')) : undefined
    await toggleLeadHold(leadId, adminUser.id, on, notes)
    revalidatePath('/admin/leads')
    return { ok: true }
  } catch (err) { return mapError(err) }
}

export async function createCampaignAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const input: any = {
      name: String(formData.get('name') ?? ''),
      source: formData.get('source') ? String(formData.get('source')) : null,
      is_active: formData.get('is_active') === 'on' || formData.get('is_active') === undefined,
      budget_amount: formData.get('budget_amount') ?? null,
      start_date: formData.get('start_date') ? String(formData.get('start_date')) : null,
      end_date: formData.get('end_date') ? String(formData.get('end_date')) : null,
    }
    if (!input.name) return { error: 'Name ist erforderlich.' }
    await createCampaign(input, adminUser.id)
    revalidatePath('/admin/campaigns')
    revalidatePath('/admin/stats')
    return { ok: true }
  } catch (err) { return mapError(err) }
}

export async function updateCampaignAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const id = String(formData.get('id'))
    const patch: any = {}
    for (const k of ['name','source','is_active','budget_amount','start_date','end_date']) {
      if (formData.has(k)) {
        if (k === 'is_active') patch.is_active = formData.get(k) === 'on'
        else if (k === 'budget_amount') patch.budget_amount = formData.get(k) ? Number(formData.get(k)) : null
        else patch[k] = formData.get(k) ? String(formData.get(k)) : null
      }
    }
    await updateCampaign(id, patch, adminUser.id)
    revalidatePath('/admin/campaigns')
    revalidatePath('/admin/stats')
    return { ok: true }
  } catch (err) { return mapError(err) }
}

/* ========= Batch J/L Admin Seller + Settings Actions ========= */
export async function bulkCreditTokensAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const idsRaw = String(formData.get('selectedIds') ?? '')
    const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    const amount = Number(formData.get('amount') ?? 0)
    const reason = String(formData.get('reason') ?? 'Massen-Aufladung')
    if (!ids.length) return { error: 'Keine Verkäufer ausgewählt.' }
    if (amount <= 0) return { error: 'Betrag muss größer 0 sein.' }
    const { creditTokens } = await import('@/lib/services/tokens.service')
    for (const id of ids) {
      try {
        await creditTokens(id, amount, reason, adminUser.id, 'aufladung')
      } catch (e) {
        log.warn('ACTIONS', 'bulkCreditTokensAction: einzelner User fehlgeschlagen', { user_id: id }, e)
      }
    }
    revalidatePath('/admin/sellers')
    revalidatePath('/admin/tokens')
    return { ok: true, toast: { title: `${amount}×${ids.length} Tokens gutgeschrieben`, variant: 'success' as const } }
  } catch (err) { return (typeof (mapError as any) === 'function') ? (mapError as any)(err) : { error: String(err) } }
}

export async function createTeamAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const name = String(formData.get('name') ?? '').trim()
    const color = formData.get('color') ? String(formData.get('color')) : null
    if (!name) return { error: 'Team-Name ist erforderlich.' }
    const { createTeam } = await import('@/lib/services/teams.service')
    await createTeam(name, color, adminUser.id)
    revalidatePath('/admin/sellers')
    revalidatePath('/admin/settings')
    return { ok: true }
  } catch (err) { return (typeof (mapError as any) === 'function') ? (mapError as any)(err) : { error: String(err) } }
}

export async function updateSellerTeamAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const userId = String(formData.get('userId'))
    const teamId = formData.get('team_id') ? String(formData.get('team_id')) : null
    const admin = createAdminClient()
    await admin.from('users').update({ team_id: teamId }).eq('id', userId)
    await (logAudit as any)(adminUser.id, 'SELLER_UPDATED', 'user', userId, { team_id: teamId })
    revalidatePath('/admin/sellers')
    return { ok: true }
  } catch (err) { return (typeof (mapError as any) === 'function') ? (mapError as any)(err) : { error: String(err) } }
}

export async function saveNotifyPrefsAction(formData: FormData) {
  try {
    const user = await requireUser()
    const admin = createAdminClient()
    const payload = {
      user_id: user.id,
      push_callbacks: formData.get('push_callbacks') === 'on',
      push_leads: formData.get('push_leads') === 'on',
      push_tokens: formData.get('push_tokens') === 'on',
      email_summary: formData.get('email_summary') === 'on',
      email_tokens: formData.get('email_tokens') === 'on',
    }
    const { error } = await admin.from('notification_preferences').upsert(payload, { onConflict: 'user_id' })
    if (error) throw error
    revalidatePath('/settings')
    return { ok: true, toast: { title: 'Benachrichtigungen gespeichert', variant: 'success' as const } }
  } catch (err) { return (typeof (mapError as any) === 'function') ? (mapError as any)(err) : { error: String(err) } }
}

export async function createSellerWithTeamAction(formData: FormData) {
  try {
    const createRes = await createSellerAction(formData) as any
    if (createRes.error) return createRes
    if (createRes.ok && createRes.userId) {
      const teamId = formData.get('team_id') ? String(formData.get('team_id')) : null
      if (teamId) {
        const admin = createAdminClient()
        await admin.from('users').update({ team_id: teamId }).eq('id', createRes.userId)
      }
    }
    revalidatePath('/admin/sellers')
    return createRes
  } catch (err) { return (typeof (mapError as any) === 'function') ? (mapError as any)(err) : { error: String(err) } }
}

export async function updateSellerWithTeamAction(formData: FormData) {
  try {
    const updRes = await updateSellerAction(formData) as any
    if (updRes.error) return updRes
    await updateSellerTeamAction(formData)
    return { ok: true }
  } catch (err) { return (typeof (mapError as any) === 'function') ? (mapError as any)(err) : { error: String(err) } }
}

/* =========================
   Benachrichtigungen
   ========================= */

export async function getNotificationsAction(onlyUnread = false, limit = 50) {
  try {
    const user = await requireUser()
    const rows = await svcGetNotifications(user.id, { onlyUnread, limit })
    return { ok: true as const, data: rows }
  } catch (err) {
    return mapError(err)
  }
}

export async function getUnreadCountAction() {
  try {
    const user = await requireUser()
    const count = await svcUnreadCount(user.id)
    return { ok: true as const, count }
  } catch (err) {
    return mapError(err)
  }
}

export async function markNotificationReadAction(formData: FormData) {
  try {
    const user = await requireUser()
    const id = String(formData.get('id'))
    await svcMarkRead(id, user.id)
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

export async function markAllNotificationsReadAction() {
  try {
    const user = await requireUser()
    await svcMarkAllRead(user.id)
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

/* =========================
   Schnell-Aktionen Rückruf-Erinnerungen
   ========================= */

export async function getDueCallbackRemindersAction() {
  try {
    const user = await requireUser()
    const admin = createAdminClient()
    const now = new Date()
    const in15Min = new Date(now.getTime() + 15 * 60 * 1000)
    const { data } = await admin
      .from('callbacks')
      .select('id, lead_id, callback_at, status, lead:leads(first_name, last_name, phone)')
      .eq('user_id', user.id)
      .eq('status', 'offen')
      .lte('callback_at', in15Min.toISOString())
      .order('callback_at', { ascending: true })
      .limit(10)
    return { ok: true as const, data: (data ?? []) as any[] }
  } catch (err) {
    return mapError(err)
  }
}

/* =========================
   Client-seitige Notification-Persistenz (für GlobalNotifiers)
   ========================= */

export async function persistLeadAvailableNotificationAction(_prev: any, formData: FormData) {
  try {
    const user = await requireSeller()
    const product = (formData.get('product') as string | null) ?? null
    const count = Number(formData.get('count') ?? '1') || 1
    await notifyLeadAvailable(user.id, product, count)
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

export async function persistCallbackDueNotificationAction(_prev: any, formData: FormData) {
  try {
    const user = await requireSeller()
    const leadId = String(formData.get('leadId'))
    const leadName = String(formData.get('leadName') ?? 'Lead')
    const callbackAt = String(formData.get('callbackAt'))
    await notifyCallbackDue(user.id, leadId, leadName, callbackAt)
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (err) {
    return mapError(err)
  }
}

/* ========= Lead-Löschen (Admin) + Storno (Seller → Admin) ========= */

export async function adminDeleteLeadAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const leadId = String(formData.get('leadId'))
    const reason = formData.get('reason') ? String(formData.get('reason')) : ''
    await adminSoftDeleteLead(leadId, adminUser.id, reason)
    revalidatePath('/admin/leads')
    revalidatePath('/admin/dashboard')
    revalidatePath('/admin/stats')
    return {
      ok: true,
      toast: { title: 'Lead gelöscht', description: `#${leadId.slice(0, 8)}`, variant: 'success' as const },
    }
  } catch (err) {
    return mapError(err)
  }
}

export async function sellerRequestCancellationAction(formData: FormData) {
  try {
    const user = await requireSeller()
    const leadId = String(formData.get('leadId'))
    const reason = formData.get('reason') ? String(formData.get('reason')) : 'Keine Angabe'
    await svcRequestCancellation(leadId, user.id, reason)
    revalidatePath('/dashboard')
    revalidatePath(`/leads/${leadId}`)
    return {
      ok: true,
      toast: { title: 'Storno beantragt', description: 'Admin wurde benachrichtigt.', variant: 'success' as const },
    }
  } catch (err) {
    return mapError(err)
  }
}

export async function adminReviewCancellationAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const requestId = String(formData.get('requestId'))
    const decision = String(formData.get('decision')) // 'approve' | 'reject'
    const refund = formData.get('refund') === 'on' || formData.get('refund') === 'true'
    const notes = formData.get('notes') ? String(formData.get('notes')) : ''
    if (decision !== 'approve' && decision !== 'reject') return { error: 'Ungültige Entscheidung.' }
    await svcReviewCancellation(requestId, adminUser.id, decision === 'approve', refund, notes)
    revalidatePath('/admin/tokens')
    revalidatePath('/admin/leads')
    revalidatePath('/admin/dashboard')
    return {
      ok: true,
      toast: {
        title: decision === 'approve' ? 'Storno genehmigt' : 'Storno abgelehnt',
        variant: 'success' as const,
      },
    }
  } catch (err) {
    return mapError(err)
  }
}

/* ============================================================
   Erweiterte Admin-Benutzerverwaltung (0017)
   ============================================================ */

export async function deleteSellerAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const userId = String(formData.get('userId'))
    const reason = String(formData.get('reason') ?? '').trim()
    await svcSoftDeleteSeller(userId, adminUser.id, reason)
    revalidatePath('/admin/sellers')
    revalidatePath(`/admin/sellers/${userId}`)
    return {
      ok: true,
      toast: {
        title: 'Benutzer gelöscht',
        description: 'Konto wurde deaktiviert und unsichtbar gesetzt.',
        variant: 'success' as const,
      },
    }
  } catch (err) {
    return mapError(err)
  }
}

export async function restoreSellerAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const userId = String(formData.get('userId'))
    await svcRestoreSeller(userId, adminUser.id)
    revalidatePath('/admin/sellers')
    revalidatePath(`/admin/sellers/${userId}`)
    return {
      ok: true,
      toast: {
        title: 'Benutzer wiederhergestellt',
        description: 'Konto ist wieder sichtbar.',
        variant: 'success' as const,
      },
    }
  } catch (err) {
    return mapError(err)
  }
}

export async function updateSellerEmailAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const userId = String(formData.get('userId'))
    const newEmail = String(formData.get('email') ?? '')
    await svcUpdateSellerEmail(userId, newEmail, adminUser.id)
    revalidatePath('/admin/sellers')
    revalidatePath(`/admin/sellers/${userId}`)
    return {
      ok: true,
      toast: { title: 'E-Mail aktualisiert', variant: 'success' as const },
    }
  } catch (err) {
    return mapError(err)
  }
}

export async function generateMagicLinkAction(formData: FormData) {
  try {
    await requireAdmin()
    const userId = String(formData.get('userId'))
    const res = await svcGenerateMagicLink(userId)
    return { ok: true, link: res.link, expires_at: res.expires_at }
  } catch (err) {
    return mapError(err)
  }
}

export async function bulkDeactivateAction(formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const idsRaw = String(formData.get('selectedIds') ?? '')
    const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    const reason = String(formData.get('reason') ?? 'Massen-Deaktivierung')
    if (!ids.length) return { error: 'Keine Benutzer ausgewählt.' }
    const r = await svcBulkDeactivate(ids, adminUser.id, reason)
    revalidatePath('/admin/sellers')
    return {
      ok: true,
      toast: {
        title: `${r.ok}/${ids.length} deaktiviert`,
        description: r.skipped.length ? `Fehler: ${r.skipped.length}` : undefined,
        variant: 'success' as const,
      },
    }
  } catch (err) {
    return mapError(err)
  }
}

/* ============================================================
   System Settings + Maintenance + Health Checks
   ============================================================ */

export async function toggleMaintenanceAction(_prev: any, formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const enable = formData.get('enable') === 'true' || formData.get('enable') === 'on'
    const message = formData.get('message')
      ? String(formData.get('message')).trim()
      : undefined
    const { setMaintenanceMode } = await import('@/lib/services/system.service')
    await setMaintenanceMode(enable, message, adminUser.id)
    revalidatePath('/admin/settings')
    revalidatePath('/dashboard')
    return {
      ok: true,
      toast: {
        title: enable ? 'Wartungsmodus AKTIVIERT' : 'Wartungsmodus deaktiviert',
        description: enable ? 'Nicht-Admin Benutzer werden ausgesperrt.' : 'Alle Benutzer haben wieder Zugriff.',
        variant: enable ? ('default' as const) : ('success' as const),
      },
    }
  } catch (err) { return mapError(err) }
}

export async function toggleLandingApiAction(_prev: any, formData: FormData) {
  try {
    const adminUser = await requireAdmin()
    const enable = formData.get('enable') === 'true' || formData.get('enable') === 'on'
    const { setLandingApiEnabled } = await import('@/lib/services/system.service')
    await setLandingApiEnabled(enable, adminUser.id)
    revalidatePath('/admin/settings')
    return {
      ok: true,
      toast: {
        title: enable ? 'Landing API AKTIVIERT' : 'Landing API DEAKTIVIERT',
        description: enable ? 'Externe Leads werden wieder angenommen.' : 'Externe Lead-Annahmen werden abgewiesen.',
        variant: 'success' as const,
      },
    }
  } catch (err) { return mapError(err) }
}

export async function runHealthCheckAction() {
  try {
    await requireAdmin()
    const { runHealthChecks } = await import('@/lib/services/system.service')
    const status = await runHealthChecks()
    return { ok: true as const, status }
  } catch (err) { return { ok: false as const, ...mapError(err) } }
}

export async function getSystemSettingsAction() {
  try {
    await requireAdmin()
    const { getAllSettings, getMaintenanceMode, getLandingApiEnabled } = await import(
      '@/lib/services/system.service'
    )
    const [raw, maintenance, landing] = await Promise.all([
      getAllSettings(),
      getMaintenanceMode(),
      getLandingApiEnabled(),
    ])
    return { ok: true as const, raw, maintenance, landing_api_enabled: landing }
  } catch (err) { return { ok: false as const, ...mapError(err) } }
}

export async function clearAppCacheAction() {
  try {
    await requireAdmin()
    const paths = [
      '/admin/dashboard',
      '/admin/leads',
      '/admin/sellers',
      '/admin/stats',
      '/admin/tokens',
      '/dashboard',
      '/my-leads',
      '/leads',
      '/callbacks',
    ]
    for (const p of paths) revalidatePath(p)
    return {
      ok: true,
      toast: {
        title: 'Cache geleert',
        description: `${paths.length} Pfade wurden revalidiert.`,
        variant: 'success' as const,
      },
    }
  } catch (err) { return mapError(err) }
}



