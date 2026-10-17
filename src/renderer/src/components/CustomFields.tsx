import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CustomEntity, CustomField, CustomValues } from '@shared/types'
import { fieldLabel, fieldValue } from '@shared/i18n'
import { currentLang } from '../i18n'

/** Active custom fields of one form (visitor, vehicle or delivery). */
export function useCustomFields(entity: CustomEntity, includeInactive = false): CustomField[] {
  const [fields, setFields] = useState<CustomField[]>([])
  useEffect(() => {
    window.api.customFields.list(includeInactive).then((all) => setFields(all.filter((f) => f.entity === entity)))
  }, [entity, includeInactive])
  return fields
}

export const missingRequired = (fields: CustomField[], values: CustomValues): CustomField[] =>
  fields.filter((f) => f.active && f.required && !String(values[String(f.id)] ?? '').trim())

/** Inputs for a set of custom fields. `only` picks the required or the optional ones. */
export function CustomFieldInputs({ fields, values, onChange, only, missing = [] }: {
  fields: CustomField[]
  values: CustomValues
  onChange(v: CustomValues): void
  only: 'required' | 'optional'
  missing?: CustomField[]
}): ReactNode {
  const { t } = useTranslation()
  const lang = currentLang()
  const list = fields.filter((f) => f.active && (only === 'required' ? f.required : !f.required))
  if (list.length === 0) return null
  const set = (id: number, v: string): void => onChange({ ...values, [String(id)]: v })

  return (
    <div className="custom-fields">
      {list.map((f) => {
        const id = String(f.id)
        const v = values[id] ?? ''
        const invalid = !v && missing.some((m) => m.id === f.id)
        const label = fieldLabel(f, lang)
        let input: ReactNode
        if (f.type === 'select') {
          input = (
            <select value={v} onChange={(e) => set(f.id, e.target.value)} aria-invalid={invalid}>
              <option value="">{t('custom.choose')}</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          )
        } else if (f.type === 'yesno') {
          input = (
            <div className="seg compact" role="radiogroup" aria-label={label}>
              {(['yes', 'no'] as const).map((x) => (
                <button key={x} type="button" role="radio" aria-checked={v === x} className={`seg-btn ${v === x ? 'on' : ''}`}
                  onClick={() => set(f.id, v === x ? '' : x)}>{t(`common.${x}`)}</button>
              ))}
            </div>
          )
        } else {
          input = (
            <input value={v} onChange={(e) => set(f.id, e.target.value)} aria-invalid={invalid} dir="auto"
              type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} />
          )
        }
        return <label key={f.id} className={`${f.required ? 'req' : ''} ${invalid ? 'invalid' : ''}`}>{label}{input}</label>
      })}
    </div>
  )
}

/** Read-only list of the custom values of a record, for detail views. */
export function customRows(fields: CustomField[], values: CustomValues): [string, string][] {
  const lang = currentLang()
  return fields.filter((f) => values[String(f.id)]).map((f) => [fieldLabel(f, lang), fieldValue(f, values[String(f.id)], lang)])
}
