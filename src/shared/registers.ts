// Rules of the register engine shared by the desktop app (src/main/registers.ts) and the web demo:
// what a register definition may contain, and how a submitted value is checked and stored.
import {
  REGISTER_FIELD_TYPES, type AccountValue, type EntryInputValues, type EntryValues, type FieldInput, type FieldValue,
  type Labels, type PersonValue, type RegisterDefInput, type RegisterField, type Role, type YesNoNote
} from './types'

const ROLES: Role[] = ['admin', 'leader', 'guard']
const KEY = /^[a-z][a-z0-9_]{0,39}$/
const MAX_TEXT = 500
const MAX_LONG = 5000

const fail = (key: string, arg = ''): never => {
  throw new Error(arg ? `${key}:${arg}` : key)
}

const cleanLabels = (l: Partial<Labels> | null | undefined): Labels => {
  const out = { ar: String(l?.ar ?? '').trim(), en: String(l?.en ?? '').trim(), fr: String(l?.fr ?? '').trim() }
  if (!out.ar && !out.en && !out.fr) fail('error.labelRequired')
  return out
}

/** A label in the asked language, falling back to the others */
export const labelOf = (l: Labels, lang: string): string => (l as Record<string, string>)[lang] || l.ar || l.fr || l.en

/** Checks and normalises a register definition sent by an administrator. */
export function cleanDefinition(def: RegisterDefInput): RegisterDefInput {
  if (!KEY.test(def.key)) fail('error.badKey')
  const roles = (r: Role[]): Role[] => ROLES.filter((x) => (r ?? []).includes(x))
  const fillRoles = roles(def.fillRoles)
  if (fillRoles.length === 0) fail('error.rolesRequired')
  const seen = new Set<string>()
  const fields: RegisterField[] = (def.fields ?? []).map((f) => {
    if (!KEY.test(f.key) || seen.has(f.key)) fail('error.badKey', f.key)
    seen.add(f.key)
    if (!REGISTER_FIELD_TYPES.includes(f.type)) fail('error.badType', f.key)
    const options = f.type === 'select' ? (f.options ?? []).map((o) => String(o).trim()).filter(Boolean) : []
    if (f.type === 'select' && options.length === 0) fail('error.optionsRequired', f.key)
    return {
      key: f.key, labels: cleanLabels(f.labels), type: f.type, options, required: !!f.required,
      // ID numbers of a person are always kept encrypted
      sensitive: !!f.sensitive || f.type === 'person', step: f.step === 'close' ? 'close' : 'open', active: f.active !== false
    }
  })
  const closeLabels = def.closeLabels ? cleanLabels(def.closeLabels) : null
  if (!closeLabels && fields.some((f) => f.step === 'close')) fail('error.noCloseStep')
  if (fields.filter((f) => f.active && f.step === 'open').length === 0) fail('error.fieldsRequired')
  return {
    id: def.id, key: def.key, labels: cleanLabels(def.labels), icon: String(def.icon || 'book').slice(0, 30),
    fillRoles, closeRoles: closeLabels ? roles(def.closeRoles).length ? roles(def.closeRoles) : fillRoles : [],
    closeLabels, sort: Math.round(Number(def.sort) || 0), active: def.active !== false, fields
  }
}

/** Looks up accounts and checks PINs: the app and the demo answer these differently. */
export interface ValueResolvers {
  account(userId: number): AccountValue | null
  /** the active account owning this PIN */
  signature(pin: string): AccountValue | null
}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** One submitted value, checked against its field. null = left empty. */
export function cleanValue(f: RegisterField, input: FieldInput | undefined, r: ValueResolvers): FieldValue | null {
  if (input === undefined || input === null) return null
  switch (f.type) {
    case 'text': return str(input, MAX_TEXT) || null
    case 'longtext': return str(input, MAX_LONG) || null
    case 'number': {
      const s = str(input, 30)
      if (!s) return null
      return /^-?\d+([.,]\d+)?$/.test(s) ? s.replace(',', '.') : fail('error.badValue', f.key)
    }
    case 'date': { const s = str(input, 10); return !s ? null : /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fail('error.badValue', f.key) }
    case 'time': { const s = str(input, 5); return !s ? null : /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : fail('error.badValue', f.key) }
    case 'datetime': { const s = str(input, 16); return !s ? null : /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : fail('error.badValue', f.key) }
    case 'yesno': { const s = str(input, 3); return !s ? null : s === 'yes' || s === 'no' ? s : fail('error.badValue', f.key) }
    case 'yesno_note': {
      const v = input as YesNoNote
      if (typeof v !== 'object' || (v.answer !== 'yes' && v.answer !== 'no')) return null
      const note = str(v.note, 1000)
      // "other: specify" — a "no" must say what is wrong
      if (v.answer === 'no' && !note) fail('error.noteRequired', f.key)
      return { answer: v.answer, note }
    }
    case 'select': { const s = str(input, MAX_TEXT); return !s ? null : f.options.includes(s) ? s : fail('error.badValue', f.key) }
    case 'person': {
      const v = input as PersonValue
      if (typeof v !== 'object') return null
      const p = { name: str(v.name, 200), idType: str(v.idType, 60), idNumber: str(v.idNumber, 60) }
      if (!p.name && !p.idNumber) return null
      return p.name ? p : fail('error.badValue', f.key)
    }
    case 'account': {
      const id = Number((input as { userId: number }).userId)
      if (!id) return null
      return r.account(id) ?? fail('error.badValue', f.key)
    }
    case 'signature': {
      const pin = str((input as { pin: string }).pin, 8)
      if (!pin) return null
      return r.signature(pin) ?? fail('error.signaturePin', f.key)
    }
  }
}

/** All values of one step (opening or closing), with the required ones checked. Unknown keys are dropped. */
export function cleanStep(fields: RegisterField[], step: 'open' | 'close', input: EntryInputValues, r: ValueResolvers): EntryValues {
  const out: EntryValues = {}
  for (const f of fields.filter((x) => x.active && x.step === step)) {
    const v = cleanValue(f, input?.[f.key], r)
    if (v === null) {
      if (f.required) fail('error.fieldRequired', f.key)
    } else {
      out[f.key] = v
    }
  }
  return out
}

/** Splits values into the plain part and the part kept encrypted. */
export function splitSensitive(fields: RegisterField[], values: EntryValues): { plain: EntryValues; secret: EntryValues } {
  const plain: EntryValues = {}
  const secret: EntryValues = {}
  for (const [k, v] of Object.entries(values)) {
    if (fields.find((f) => f.key === k)?.sensitive) secret[k] = v
    else plain[k] = v
  }
  return { plain, secret }
}

/** A value as one line of text, for lists, search and printed reports. */
export function valueText(f: RegisterField | undefined, v: FieldValue | null | undefined, yesNo: { yes: string; no: string }): string {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'string') {
    if (f?.type === 'yesno') return v === 'yes' ? yesNo.yes : yesNo.no
    if (f?.type === 'datetime') return v.replace('T', ' ')
    return v
  }
  if ('answer' in v) return v.answer === 'yes' ? yesNo.yes : `${yesNo.no}${v.note ? ` — ${v.note}` : ''}`
  if ('idNumber' in v) return [v.name, v.idType, v.idNumber].filter(Boolean).join(' · ')
  return v.name
}
