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
  archived: 'Archiviert',
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
  archived: 'secondary',
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
  archived: 'bg-slate-50 text-slate-500 border-slate-200',
}

export const STATUS_COLORS: Record<
  string,
  { bg: string; text: string; dot: string; ring?: string }
> = {
  new: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500' },
  assigned: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  contacted: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  callback: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  offer: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  closed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  no_interest: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  wrong_data: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  canceled: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  archived: { bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-400' },
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
  landing_page: 'Landing Page',
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
  LEAD_UPDATED: 'Lead bearbeitet',
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
  LEAD_DELETED: 'Lead gelöscht (Admin)',
  LEAD_CANCEL_REQUEST: 'Lead-Storno angefordert (Verkäufer)',
  LEAD_CANCEL_APPROVED: 'Lead-Storno genehmigt (Admin)',
  LEAD_CANCEL_REJECTED: 'Lead-Storno abgelehnt (Admin)',
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

/**
 * Formatiert Sekunden als Gesprächszeit (mm:ss, bei ≥ 1 Stunde h:mm:ss).
 * @param seconds
 */
export const formatCallDuration = (seconds: number | null | undefined): string | null => {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds) || seconds <= 0) return null
  const s = Math.max(0, Math.round(Number(seconds)))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export const formatCallDurationLong = (seconds: number | null | undefined): string | null => {
  const short = formatCallDuration(seconds)
  if (!short) return null
  const s = Math.max(0, Math.round(Number(seconds ?? 0)))
  if (s < 60) return `${s} Sek.`
  const min = (s / 60).toFixed(1).replace('.', ',')
  return `${short} · ${min} Min.`
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
