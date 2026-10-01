export type UserRole = 'admin' | 'seller'

export type LeadStatus =
  | 'new'
  | 'assigned'
  | 'contacted'
  | 'callback'
  | 'offer'
  | 'closed'
  | 'no_interest'
  | 'wrong_data'
  | 'canceled'

export type ProductType = 'strom' | 'gas' | 'beides'

export type LeadSource =
  | 'meta_ads'
  | 'google_ads'
  | 'manual'
  | 'import'
  | 'empfehlung'
  | 'sonstiges'

export type ContactResult =
  | 'keine_antwort'
  | 'besetzt'
  | 'rueckruf'
  | 'interessiert'
  | 'kein_interesse'
  | 'falsche_daten'
  | 'sonstiges'

export type CallbackStatus = 'offen' | 'erledigt' | 'storniert'

export type TokenTransactionType =
  | 'aufladung'
  | 'lead_kauf'
  | 'rueckerstattung'
  | 'korrektur_plus'
  | 'korrektur_minus'

export type AuditActionType =
  | 'LEAD_ASSIGNED'
  | 'LEAD_CREATED'
  | 'LEAD_RESET'
  | 'LEAD_HOLD_UPDATED'
  | 'LEAD_UPDATED'
  | 'STATUS_CHANGED'
  | 'TOKEN_DEBIT'
  | 'TOKEN_CREDIT'
  | 'SELLER_CREATED'
  | 'SELLER_UPDATED'
  | 'SELLER_DEACTIVATED'
  | 'SELLER_ACTIVATED'
  | 'ADMIN_CHANGE'
  | 'CONTACT_ATTEMPT'
  | 'CALLBACK_CREATED'
  | 'CALLBACK_UPDATED'
  | 'DOCUMENT_UPLOADED'
  | 'TAG_ASSIGNED'

export interface Team {
  id: string
  name: string
  color: string | null
  created_at: string
}

export interface DatabaseUser {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  is_active: boolean
  team_id: string | null
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  name: string
  source: LeadSource | null
  external_id: string | null
  is_active: boolean
  budget_amount: number | null
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  street: string | null
  zip: string | null
  city: string | null
  product: ProductType
  power_consumption: number | null
  gas_consumption: number | null
  source: LeadSource
  campaign_id: string | null
  status: LeadStatus
  assigned_user_id: string | null
  notes: string | null
  token_cost: number
  is_on_hold: boolean
  hold_notes: string | null
  created_at: string
  updated_at: string
}

export interface LeadStatusHistory {
  id: string
  lead_id: string
  old_status: LeadStatus
  new_status: LeadStatus
  user_id: string
  note?: string | null
  created_at: string
}

export interface ContactAttempt {
  id: string
  lead_id: string
  user_id: string
  attempt_date: string
  result: ContactResult
  notes: string | null
  created_at: string
}

export interface Callback {
  id: string
  lead_id: string
  user_id: string
  callback_at: string
  notes: string | null
  status: CallbackStatus
  created_at: string
  updated_at: string
}

export interface TokenWallet {
  id: string
  user_id: string
  balance: number
  created_at: string
  updated_at: string
}

export interface TokenTransaction {
  id: string
  wallet_id: string
  user_id: string
  amount: number
  type: TokenTransactionType
  reason: string | null
  lead_id: string | null
  created_by: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  action: AuditActionType
  resource_type: string
  resource_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface LeadWithDetails extends Lead {
  assigned_user?: { full_name: string; email: string } | null
  campaign?: Campaign | null
  callbacks?: Callback[]
  contact_attempts?: ContactAttempt[]
  status_history?: LeadStatusHistory[]
  tags?: Tag[]
  documents?: LeadDocument[]
  team?: Team | null
}

export interface Tag {
  id: string
  name: string
  color: string | null
  created_at: string
}

export interface LeadDocument {
  id: string
  lead_id: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  storage_path: string
  created_by: string | null
  created_at: string
}

export interface WaitlistEntry {
  id: string
  user_id: string
  product: ProductType | null
  created_at: string
  notified_at: string | null
}

export type TargetType =
  | 'abschluesse'
  | 'leads'
  | 'kontaktquote'
  | 'token_einsparung'

export type PeriodType = 'day' | 'week' | 'month'

export interface SellerTarget {
  id: string
  user_id: string
  period_type: PeriodType
  period_label: string
  target_type: TargetType
  target_value: number
  created_at: string
}

export interface NotificationPreferences {
  user_id: string
  push_callbacks: boolean
  push_leads: boolean
  push_tokens: boolean
  email_summary: boolean
  email_tokens: boolean
  updated_at: string
}

export interface TimeHeatmapCell {
  day_of_week: number
  hour_of_day: number
  attempts: number
  reached: number
}

export type NotificationType =
  | 'lead_assigned'
  | 'lead_available'
  | 'token_credit'
  | 'token_low'
  | 'callback_due'
  | 'callback_overdue'
  | 'status_changed'
  | 'contact_attempt'
  | 'admin_alert'
  | 'info'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  data: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}
