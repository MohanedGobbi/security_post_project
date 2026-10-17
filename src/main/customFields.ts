import type { CustomEntity, CustomField, CustomFieldInput, CustomFieldType, CustomValues } from '@shared/types'
import { conn } from './db'

const TYPES: CustomFieldType[] = ['text', 'number', 'yesno', 'select', 'date']
const ENTITIES: CustomEntity[] = ['visit', 'vehicle', 'delivery']

interface FieldDb { id: number; entity: CustomEntity; labels_json: string; type: CustomFieldType; options_json: string; required: number; active: number }

const toField = (r: FieldDb): CustomField => {
  const labels = JSON.parse(r.labels_json) as CustomField['labels']
  return {
    id: r.id, entity: r.entity, type: r.type, options: JSON.parse(r.options_json) as string[], required: r.required === 1, active: r.active === 1,
    labels: { ar: labels.ar ?? '', en: labels.en ?? '', fr: labels.fr ?? '' }
  }
}

const cleanLabels = (l: Partial<CustomField['labels']> | undefined): CustomField['labels'] => {
  const labels = { ar: (l?.ar ?? '').trim(), en: (l?.en ?? '').trim(), fr: (l?.fr ?? '').trim() }
  if (!labels.ar && !labels.en && !labels.fr) throw new Error('error.labelRequired')
  return labels
}

const cleanOptions = (type: CustomFieldType, options: string[] | undefined): string[] => {
  const list = [...new Set((options ?? []).map((o) => o.trim()).filter(Boolean))]
  if (type === 'select' && list.length < 2) throw new Error('error.optionsRequired')
  return type === 'select' ? list : []
}

export function listFields(includeInactive: boolean): CustomField[] {
  const rows = conn().prepare(`SELECT * FROM custom_fields ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY entity, sort, id`).all() as unknown as FieldDb[]
  return rows.map(toField)
}

export function addField(input: CustomFieldInput): number {
  if (!ENTITIES.includes(input.entity) || !TYPES.includes(input.type)) throw new Error('error.generic')
  const r = conn().prepare('INSERT INTO custom_fields (entity, labels_json, type, options_json, required, sort) VALUES (?, ?, ?, ?, ?, ?)').run(
    input.entity, JSON.stringify(cleanLabels(input.labels)), input.type, JSON.stringify(cleanOptions(input.type, input.options)),
    input.required ? 1 : 0, Date.now() % 1e9
  )
  return Number(r.lastInsertRowid)
}

/** The type and entity of a field never change, so values already stored keep their meaning. */
export function updateField(id: number, patch: Partial<CustomFieldInput> & { active?: boolean }): void {
  const db = conn()
  const r = db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(id) as FieldDb | undefined
  if (!r) throw new Error('error.notFound')
  const f = toField(r)
  if (patch.labels) db.prepare('UPDATE custom_fields SET labels_json = ? WHERE id = ?').run(JSON.stringify(cleanLabels(patch.labels)), id)
  if (patch.options) db.prepare('UPDATE custom_fields SET options_json = ? WHERE id = ?').run(JSON.stringify(cleanOptions(f.type, patch.options)), id)
  if (patch.required !== undefined) db.prepare('UPDATE custom_fields SET required = ? WHERE id = ?').run(patch.required ? 1 : 0, id)
  if (patch.active !== undefined) db.prepare('UPDATE custom_fields SET active = ? WHERE id = ?').run(patch.active ? 1 : 0, id)
}

/**
 * Keeps only the active fields of the entity, normalises each value to its type and enforces required fields.
 * Throws `error.customRequired:<field id>` so the UI can point at the missing field.
 */
export function cleanValues(entity: CustomEntity, values: CustomValues | undefined): CustomValues {
  const out: CustomValues = {}
  for (const f of listFields(false).filter((x) => x.entity === entity)) {
    let v = String(values?.[String(f.id)] ?? '').trim()
    if (f.type === 'number' && v && !Number.isFinite(Number(v.replace(',', '.')))) v = ''
    if (f.type === 'number' && v) v = String(Number(v.replace(',', '.')))
    if (f.type === 'yesno' && v && v !== 'yes' && v !== 'no') v = ''
    if (f.type === 'select' && v && !f.options.includes(v)) v = ''
    if (f.type === 'date' && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) v = ''
    if (f.required && !v) throw new Error(`error.customRequired:${f.id}`)
    if (v) out[String(f.id)] = v.slice(0, 500)
  }
  return out
}
