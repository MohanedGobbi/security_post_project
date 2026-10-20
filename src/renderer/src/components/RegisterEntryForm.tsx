import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntryInputValues, RegisterDef, RegisterField } from '@shared/types'
import { labelOf } from '@shared/registers'
import { currentLang } from '../i18n'
import Icon, { registerIcon } from './Icon'
import { FieldInputs, missingFields, type AccountOption } from './RegisterFields'
import { errorText } from '../util'

/** "error.fieldRequired:key" names the field by its label in the current language */
export function fieldError(err: unknown, reg: RegisterDef, t: (k: string, o?: Record<string, unknown>) => string): string {
  const msg = err instanceof Error ? err.message : String(err)
  const m = msg.match(/(error\.\w+):([a-z][a-z0-9_]*)/)
  const f = m ? reg.fields.find((x) => x.key === m[2]) : undefined
  return f && m ? t(m[1], { s: labelOf(f.labels, currentLang()) }) : errorText(err, t as never)
}

/** Accounts for the register's 'account' fields (loaded only when it has some) */
export function useAccounts(reg: RegisterDef): AccountOption[] {
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const needed = reg.fields.some((f) => f.type === 'account')
  useEffect(() => {
    if (needed) window.api.registers.accounts().then(setAccounts)
  }, [needed])
  return accounts
}

/** The "new entry" form of one register: its opening fields, checked, then recorded with the next number. */
export default function RegisterEntryForm({ reg, onSaved, toast, title, children }: {
  reg: RegisterDef
  onSaved(number: number): void
  toast(text: string, kind?: 'ok' | 'error'): void
  /** heading above the fields (default: "New entry") */
  title?: string
  /** extra buttons next to the record button */
  children?: ReactNode
}): ReactNode {
  const { t } = useTranslation()
  const lang = currentLang()
  const accounts = useAccounts(reg)
  const [values, setValues] = useState<EntryInputValues>({})
  const [missing, setMissing] = useState<RegisterField[]>([])
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    const miss = missingFields(reg.fields.filter((f) => f.step === 'open'), values)
    setMissing(miss)
    if (miss.length) return toast(t('error.fieldRequired', { s: labelOf(miss[0].labels, lang) }), 'error')
    setBusy(true)
    try {
      const r = await window.api.registers.add(reg.id, values)
      toast(t('registers.recorded', { n: r.number }))
      setValues({})
      onSaved(r.number)
    } catch (err) {
      toast(fieldError(err, reg, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="register-entry-form">
      <h2>{title ?? t('registers.newEntry')}</h2>
      <FieldInputs fields={reg.fields} step="open" values={values} onChange={setValues} accounts={accounts} missing={missing} />
      <p className="hint">{t('registers.noErase')}</p>
      <div className="actions">
        {children}
        <button className="primary big" disabled={busy}><Icon name={registerIcon(reg.icon)} /> {t('registers.record')}</button>
      </div>
    </form>
  )
}
