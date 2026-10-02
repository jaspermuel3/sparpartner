export const PHONE_MIN_DIGITS = 8
export const PHONE_MAX_DIGITS = 18
export const ZIP_REGEX = /^\d{5}$/
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function stripBomWs(s?: string | null): string | undefined {
  if (!s) return undefined
  return s.replace(/^\uFEFF+/, '').trim() || undefined
}

export function isValidProduct(p: string): boolean {
  return p === 'strom' || p === 'gas' || p === 'beides'
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

export function isValidZip(zip: string): boolean {
  return ZIP_REGEX.test(zip.trim())
}

export type PasswordPolicyResult = {
  ok: boolean
  errors: string[]
}

const PASSWORD_MIN_LENGTH = 10
const PASSWORD_MAX_LENGTH = 128

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const errors: string[] = []
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`)
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Passwort darf maximal ${PASSWORD_MAX_LENGTH} Zeichen lang sein.`)
  }
  if (!/[a-z]/.test(password)) errors.push('Passwort muss mindestens einen Kleinbuchstaben enthalten.')
  if (!/[A-Z]/.test(password)) errors.push('Passwort muss mindestens einen Großbuchstaben enthalten.')
  if (!/\d/.test(password)) errors.push('Passwort muss mindestens eine Zahl enthalten.')
  const lenOk = password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH
  return { ok: lenOk && errors.length === 0, errors }
}

export type LeadInlineValidationResult = {
  ok: boolean
  normalized?: string | null
  errors?: Record<string, string>
}

export function validateLeadField(
  field: string,
  rawValue: string,
): LeadInlineValidationResult {
  const trimmed = rawValue.trim()
  switch (field) {
    case 'first_name':
    case 'last_name':
      if (!trimmed || trimmed.length < 2) {
        return {
          ok: false,
          errors: { [field]: 'Muss mindestens 2 Zeichen lang sein.' },
        }
      }
      return { ok: true, normalized: trimmed }
    case 'phone': {
      if (!trimmed) return { ok: true, normalized: null }
      if (!isValidPhone(trimmed)) {
        return {
          ok: false,
          errors: { phone: 'Bitte gib eine gültige Telefonnummer ein (8–18 Ziffern).' },
        }
      }
      return { ok: true, normalized: trimmed }
    }
    case 'email': {
      if (!trimmed) return { ok: true, normalized: null }
      if (!isValidEmail(trimmed)) {
        return {
          ok: false,
          errors: { email: 'Bitte gib eine gültige E-Mail-Adresse ein.' },
        }
      }
      return { ok: true, normalized: trimmed }
    }
    case 'zip': {
      if (!trimmed) return { ok: true, normalized: null }
      if (!isValidZip(trimmed)) {
        return {
          ok: false,
          errors: { zip: 'Bitte gib eine gültige 5-stellige PLZ ein.' },
        }
      }
      return { ok: true, normalized: trimmed }
    }
    case 'street':
    case 'city':
      if (!trimmed) return { ok: true, normalized: null }
      if (trimmed.length < 2) {
        return {
          ok: false,
          errors: { [field]: 'Muss mindestens 2 Zeichen lang sein.' },
        }
      }
      return { ok: true, normalized: trimmed }
    case 'notes':
      return { ok: true, normalized: rawValue }
    default:
      return {
        ok: false,
        errors: { _: 'Ungültiges Feld.' },
      }
  }
}
