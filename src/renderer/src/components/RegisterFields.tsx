import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntryInputValues, FieldInput, Labels, PersonValue, RegisterField, Role, YesNoNote } from '@shared/types'
import { labelOf } from '@shared/registers'
import { currentLang } from '../i18n'

export interface AccountOption { id: number; name: string; role: Role; roleLabels: Labels }

/** Is this input empty for its field? ("no" without a note counts as empty for yes/no + note) */
export function isEmptyInput(f: RegisterField, v: FieldInput | undefined): boolean {
  if (v === undefined || v === null) return true
  if (typeof v === 'string') return v.trim() === ''
  if ('answer' in v) return v.answer === 'no' && !v.note.trim()
  if ('pin' in v) return !v.pin
  if ('userId' in v) return !v.userId
  if ('name' in v) return !v.name.trim() && !(v as PersonValue).idNumber.trim()
  return f.required
}

/** Required fields of a step still empty, checked before sending (the main process checks again). */
export const missingFields = (fields: RegisterField[], values: EntryInputValues): RegisterField[] =>
  fields.filter((f) => f.active && f.required && isEmptyInput(f, values[f.key]))

/** One input for one field, whatever its type. */
export function FieldInputControl({ field, value, onChange, accounts, autoFocus }: {
  field: RegisterField
  value: FieldInput | undefined
  onChange(v: FieldInput): void
  accounts: AccountOption[]
  autoFocus?: boolean
}): ReactNode {
  const { t } = useTranslation()
  const s = typeof value === 'string' ? value : ''
  switch (field.type) {
    case 'longtext':
      return <textarea rows={3} value={s} onChange={(e) => onChange(e.target.value)} dir="auto" autoFocus={autoFocus} />
    case 'number':
      return <input inputMode="decimal" value={s} onChange={(e) => onChange(e.target.value)} dir="ltr" autoFocus={autoFocus} />
    case 'date':
      return <input type="date" value={s} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} />
    case 'time':
      return <input type="time" value={s} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} />
    case 'datetime':
      return <input type="datetime-local" value={s} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} />
    case 'yesno':
      return (
        <div className="chips" role="radiogroup">
          {(['yes', 'no'] as const).map((a) => (
            <button key={a} type="button" role="radio" aria-checked={s === a} className={s === a ? 'chip on' : 'chip'} onClick={() => onChange(a)}>
              {t(`common.${a}`)}
            </button>
          ))}
        </div>
      )
    case 'yesno_note': {
      const v = (value && typeof value === 'object' && 'answer' in value ? value : null) as YesNoNote | null
      return (
        <div className="yesno-note">
          <div className="chips" role="radiogroup">
            {(['yes', 'no'] as const).map((a) => (
              <button key={a} type="button" role="radio" aria-checked={v?.answer === a} className={v?.answer === a ? 'chip on' : 'chip'}
                onClick={() => onChange({ answer: a, note: v?.note ?? '' })}>
                {t(`common.${a}`)}
              </button>
            ))}
          </div>
          {v?.answer === 'no' && (
            <input placeholder={t('registers.specify')} value={v.note} onChange={(e) => onChange({ answer: 'no', note: e.target.value })} dir="auto" autoFocus />
          )}
        </div>
      )
    }
    case 'select':
      // a short list is quicker as chips than as a drop-down
      return field.options.length <= 6 ? (
        <div className="chips" role="radiogroup">
          {field.options.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={s === o} className={s === o ? 'chip on' : 'chip'} onClick={() => onChange(s === o ? '' : o)}>{o}</button>
          ))}
        </div>
      ) : (
        <select value={s} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t('registers.pick')}</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    case 'person': {
      const p = (value && typeof value === 'object' && 'idNumber' in value ? value : { name: '', idType: '', idNumber: '' }) as PersonValue
      return (
        <div className="row3">
          <input placeholder={t('visitor.fullName')} value={p.name} onChange={(e) => onChange({ ...p, name: e.target.value })} dir="auto" autoFocus={autoFocus} />
          <input placeholder={t('visitor.idType')} value={p.idType} onChange={(e) => onChange({ ...p, idType: e.target.value })} dir="auto" />
          <input placeholder={t('visitor.idNumber')} value={p.idNumber} onChange={(e) => onChange({ ...p, idNumber: e.target.value })} dir="ltr" />
        </div>
      )
    }
    case 'account': {
      const id = value && typeof value === 'object' && 'userId' in value ? value.userId : 0
      return (
        <select value={id || ''} onChange={(e) => onChange({ userId: Number(e.target.value) })}>
          <option value="">{t('registers.pick')}</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {labelOf(a.roleLabels, currentLang())}</option>)}
        </select>
      )
    }
    case 'signature': {
      const pin = value && typeof value === 'object' && 'pin' in value ? value.pin : ''
      return (
        <input type="password" inputMode="numeric" maxLength={8} placeholder={t('registers.pinPlaceholder')} value={pin}
          onChange={(e) => onChange({ pin: e.target.value.replace(/\D/g, '') })} dir="ltr" autoComplete="off" />
      )
    }
    default:
      return <input value={s} onChange={(e) => onChange(e.target.value)} dir="auto" autoFocus={autoFocus} />
  }
}

/** All active fields of one step, as a form section. */
export function FieldInputs({ fields, step, values, onChange, accounts, missing = [] }: {
  fields: RegisterField[]
  step: 'open' | 'close'
  values: EntryInputValues
  /** a state setter: each field updates from the latest values (two quick clicks never undo each other) */
  onChange: Dispatch<SetStateAction<EntryInputValues>>
  accounts: AccountOption[]
  missing?: RegisterField[]
}): ReactNode {
  const lang = currentLang()
  const shown = fields.filter((f) => f.active && f.step === step)
  return (
    <div className="register-fields">
      {shown.map((f, i) => {
        const label = labelOf(f.labels, lang)
        const cls = `field${f.required ? ' req' : ''}${missing.includes(f) ? ' missing' : ''}${f.half ? ' half' : ''}`
        const hint = f.hint ? labelOf(f.hint, lang) : ''
        const control = <FieldInputControl field={f} value={values[f.key]} accounts={accounts} autoFocus={i === 0}
          onChange={(v) => onChange((cur) => ({ ...cur, [f.key]: v }))} />
        // one input: a real label; chips or several inputs: a labelled group
        const grouped = f.type === 'yesno' || f.type === 'yesno_note' || f.type === 'person' || (f.type === 'select' && f.options.length <= 6)
        return grouped
          ? <div key={f.key} className={cls} role="group" aria-label={label}><span className="field-label">{label}</span>{control}{hint && <small className="field-hint">{hint}</small>}</div>
          : <label key={f.key} className={cls}><span className="field-label">{label}</span>{control}{hint && <small className="field-hint">{hint}</small>}</label>
      })}
    </div>
  )
}
