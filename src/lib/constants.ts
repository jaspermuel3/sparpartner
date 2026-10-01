import type { LeadStatus, ProductType, LeadSource, ContactResult, CallbackStatus, TokenTransactionType, AuditActionType } from '@/types'

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Neu',
  assigned: 'Zugewiesen',
  contacted: 'Kontaktiert',
  callback: 'Rückruf',
  offer: 'Angebot',
  closed: 'Abgeschlossen',
  no_interest: 'Kein Interesse',
  wrong_data: 'Falsche Daten',
  canceled: 'Storniert',
}

export const LEAD_STATUS_VARIANTS: Record<LeadStatus, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
  new: 'secondary',
  assigned: 'outline',
  contacted: 'warning',
  callback: 'default',
  offer: 'outline',
  closed: 'success',
  no_interest: 'destructive',
  wrong_data: 'destructive',
  canceled: 'secondary',
}

export const LEAD_STATUS_CLASSES: Record<LeadStatus, string> = {
  new: 'bg-slate-100 text-slate-700 border-slate-200',
  assigned: 'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200',
  callback: 'bg-orange-50 text-orange-700 border-orange-200',
  offer: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  closed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  no_interest: 'bg-red-50 text-red-700 border-red-200',
  wrong_data: 'bg-red-50 text-red-700 border-red-200',
  canceled: 'bg-slate-100 text-slate-500 border-slate-200',
}

export const PRODUCT_LABELS: Record<ProductType, string> = {
  strom: 'Strom',
  gas: 'Gas',
  beides: 'Strom + Gas',
}

export const SOURCE_LABELS: Record<LeadSource, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  manual: 'Manuell',
  import: 'Import',
  empfehlung: 'Empfehlung',
  sonstiges: 'Sonstiges',
}

export const CONTACT_RESULT_LABELS: Record<ContactResult, string> = {
  keine_antwort: 'Keine Antwort',
  besetzt: 'Besetzt',
  rueckruf: 'Kunde möchte Rückruf',
  interessiert: 'Kunde interessiert',
  kein_interesse: 'Kein Interesse',
  falsche_daten: 'Falsche Daten',
  sonstiges: 'Sonstiges',
}

export const CONTACT_RESULT_COLORS: Record<ContactResult, string> = {
  keine_antwort: 'text-slate-600',
  besetzt: 'text-slate-600',
  rueckruf: 'text-orange-600',
  interessiert: 'text-emerald-600',
  kein_interesse: 'text-red-600',
  falsche_daten: 'text-red-600',
  sonstiges: 'text-slate-600',
}

export const CALLBACK_STATUS_LABELS: Record<CallbackStatus, string> = {
  offen: 'Offen',
  erledigt: 'Erledigt',
  storniert: 'Storniert',
}

export const TOKEN_TYPE_LABELS: Record<TokenTransactionType, string> = {
  aufladung: 'Aufladung',
  lead_kauf: 'Lead-Kauf',
  rueckerstattung: 'Rückerstattung',
  korrektur_plus: 'Korrektur +',
  korrektur_minus: 'Korrektur -',
}

export const AUDIT_ACTION_LABELS: Record<AuditActionType, string> = {
  LEAD_ASSIGNED: 'Lead zugewiesen',
  LEAD_CREATED: 'Lead manuell angelegt',
  LEAD_RESET: 'Lead zurückgesetzt',
  LEAD_HOLD_UPDATED: 'Lead-Hold-Status geändert',
  STATUS_CHANGED: 'Status geändert',
  TOKEN_DEBIT: 'Token abgebucht',
  TOKEN_CREDIT: 'Token gutgeschrieben',
  SELLER_CREATED: 'Verkäufer erstellt',
  SELLER_UPDATED: 'Verkäufer bearbeitet',
  SELLER_DEACTIVATED: 'Verkäufer deaktiviert',
  SELLER_ACTIVATED: 'Verkäufer aktiviert',
  ADMIN_CHANGE: 'Admin-Änderung',
  CONTACT_ATTEMPT: 'Kontaktversuch',
  CALLBACK_CREATED: 'Rückruf erstellt',
  CALLBACK_UPDATED: 'Rückruf aktualisiert',
  DOCUMENT_UPLOADED: 'Dokument hochgeladen',
  TAG_ASSIGNED: 'Tag zugewiesen',
}

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}

export const formatDateShort = (iso: string | null | undefined): string => {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '-'
  }
}

export const formatTime = (iso: string | null | undefined): string => {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}

export const formatPhone = (phone: string): string => {
  if (!phone) return '-'
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('49')) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`
  }
  if (digits.startsWith('0049')) {
    return `+49 ${digits.slice(4, 8)} ${digits.slice(8)}`
  }
  return phone
}

export const phoneHref = (phone: string | null | undefined): string => {
  if (!phone) return '#'
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0') && !digits.startsWith('00')) {
    digits = '49' + digits.slice(1)
  }
  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }
  return `tel:+${digits}`
}

export const formatCurrency = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return '-'
  return n.toLocaleString('de-DE')
}

export const formatPercent = (frac: number | null | undefined): string => {
  if (frac === null || frac === undefined || Number.isNaN(frac)) return '-'
  return `${(frac * 100).toFixed(1).replace('.', ',')} %`
}

export const formatDaysSince = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const diffMs = Date.now() - t
  return Math.max(0, Math.floor(diffMs / 86_400_000))
}

export const leadAgeClass = (days: number | null): string => {
  if (days === null) return ''
  if (days <= 3) return 'text-emerald-600'
  if (days <= 7) return 'text-amber-600'
  return 'text-red-600'
}

export const formatRelative = (iso: string | null | undefined): string => {
  if (!iso) return '-'
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return '-'
  const diffSec = Math.max(0, Math.floor((Date.now() - d) / 1000))
  if (diffSec < 60) return 'gerade eben'
  if (diffSec < 3600) return `vor ${Math.floor(diffSec / 60)} Min.`
  if (diffSec < 86400) return `vor ${Math.floor(diffSec / 3600)} Std.`
  if (diffSec < 86400 * 7) return `vor ${Math.floor(diffSec / 86400)} Tagen`
  return formatDateShort(iso)
}

export const formatBytes = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

export const TARGET_TYPE_LABELS: Record<string, string> = {
  abschluesse: 'Abschlüsse',
  leads: 'Leads zugewiesen',
  kontaktquote: 'Kontaktquote in %',
  token_einsparung: 'Token-Einsparung',
}

export const PERIOD_LABELS: Record<string, string> = {
  day: 'Tag',
  week: 'Woche',
  month: 'Monat',
}

export const WEEKDAY_LABELS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
