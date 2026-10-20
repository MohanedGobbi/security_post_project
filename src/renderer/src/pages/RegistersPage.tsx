import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntryCorrection, EntryInputValues, FieldInput, RegisterDef, RegisterEntry, RegisterField } from '@shared/types'
import { formatDateTime } from '@shared/i18n'
import { labelOf, valueText } from '@shared/registers'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import Icon, { registerIcon } from '../components/Icon'
import { FieldInputControl, FieldInputs, missingFields, type AccountOption } from '../components/RegisterFields'
import { daysAgo, errorText, todayStr } from '../util'

/** Registers the user may use: tiles first, then one register (new entry + its entries). */
export default function RegistersPage(): ReactNode {
  const { t } = useTranslation()
  const { registerId, openRegister } = useApp()
  const [regs, setRegs] = useState<RegisterDef[] | null>(null)
  const lang = currentLang()

  useEffect(() => {
    window.api.registers.list().then(setRegs)
  }, [])

  const reg = regs?.find((r) => r.id === registerId) ?? null
  if (!regs) return <p className="empty">{t('common.loading')}</p>
  if (reg) return <RegisterView key={reg.id} reg={reg} onBack={() => openRegister(null)} />

  const usable = regs.filter((r) => r.active)
  return (
    <div className="card">
      <h1>{t('registers.title')}</h1>
      {usable.length === 0 ? <p className="empty">{t('registers.noneOpen')}</p> : (
        <section className="register-tiles">
          {usable.map((r) => (
            <button key={r.id} type="button" className="tile register-tile" onClick={() => openRegister(r.id)}>
              <span className="tile-icon"><Icon name={registerIcon(r.icon)} size={30} /></span>
              <strong>{labelOf(r.labels, lang)}</strong>
            </button>
          ))}
        </section>
      )}
    </div>
  )
}

function useYesNo(): { yes: string; no: string } {
  const { t } = useTranslation()
  return { yes: t('common.yes'), no: t('common.no') }
}

function RegisterView({ reg, onBack }: { reg: RegisterDef; onBack(): void }): ReactNode {
  const { t } = useTranslation()
  const { toast, user } = useApp()
  const lang = currentLang()
  const isAdmin = user.role === 'admin'
  const canFill = isAdmin || reg.fillRoles.includes(user.role)
  const [values, setValues] = useState<EntryInputValues>({})
  const [missing, setMissing] = useState<RegisterField[]>([])
  const [busy, setBusy] = useState(false)
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [entries, setEntries] = useState<RegisterEntry[]>([])
  const [q, setQ] = useState({ from: daysAgo(30), to: todayStr(), text: '', openOnly: false })
  const [opened, setOpened] = useState<RegisterEntry | null>(null)
  const yesNo = useYesNo()

  const needsAccounts = reg.fields.some((f) => f.type === 'account')
  useEffect(() => {
    if (needsAccounts) window.api.registers.accounts().then(setAccounts)
  }, [needsAccounts])

  const load = useCallback(() => {
    window.api.registers.entries({ registerId: reg.id, from: isAdmin ? q.from : '', to: isAdmin ? q.to : '', text: q.text, openOnly: q.openOnly })
      .then(setEntries)
      .catch((e) => toast(errorText(e, t), 'error'))
  }, [reg.id, isAdmin, q, toast, t])
  useEffect(load, [load])

  // the first two filled fields describe an entry in the list
  const summaryFields = useMemo(() => reg.fields.filter((f) => f.active && f.step === 'open').slice(0, 3), [reg])

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
      load()
    } catch (err) {
      toast(fieldError(err, reg, lang, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="split-page">
      {canFill ? (
        <form className="card" onSubmit={submit}>
          <button type="button" className="link" onClick={onBack}>← {t('registers.title')}</button>
          <div className="register-head">
            <span className="tile-icon"><Icon name={registerIcon(reg.icon)} size={26} /></span>
            <div>
              <h1>{labelOf(reg.labels, lang)}</h1>
              <p className="hint">{t('registers.openedOn', { date: formatDateTime(reg.openedAt, lang), name: reg.openedBy || '—' })}</p>
            </div>
          </div>
          <h2>{t('registers.newEntry')}</h2>
          <FieldInputs fields={reg.fields} step="open" values={values} onChange={setValues} accounts={accounts} missing={missing} />
          <p className="hint">{t('registers.noErase')}</p>
          <div className="actions">
            <button className="primary big" disabled={busy}><Icon name={registerIcon(reg.icon)} /> {t('registers.record')}</button>
          </div>
        </form>
      ) : (
        <div className="card">
          <button type="button" className="link" onClick={onBack}>← {t('registers.title')}</button>
          <h1>{labelOf(reg.labels, lang)}</h1>
        </div>
      )}

      <section className="card">
        <div className="section-head">
          <h2>{t('registers.entries')}</h2>
          <span className="count-pill">{entries.length}</span>
        </div>
        <div className="filters">
          {isAdmin ? (
            <>
              <label>{t('log.from')}<input type="date" value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} /></label>
              <label>{t('log.to')}<input type="date" value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} /></label>
            </>
          ) : <p className="hint">{t('registers.recent')}</p>}
          <label className="grow">{t('common.search')}<input value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} dir="auto" /></label>
          {reg.closeLabels && (
            <label className="check"><input type="checkbox" checked={q.openOnly} onChange={(e) => setQ({ ...q, openOnly: e.target.checked })} /> {t('registers.openOnly')}</label>
          )}
        </div>
        {entries.length === 0 ? <p className="empty">{t('registers.none')}</p> : (
          <table className="log-table">
            <thead>
              <tr>
                <th>{t('registers.number')}</th>
                <th>{t('registers.time')}</th>
                {summaryFields.map((f) => <th key={f.key}>{labelOf(f.labels, lang)}</th>)}
                {reg.closeLabels && <th>{t('registers.status')}</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((en) => (
                <tr key={en.id} tabIndex={0} onClick={() => setOpened(en)} onKeyDown={(e) => e.key === 'Enter' && setOpened(en)}>
                  <td className="mono">{en.number}</td>
                  <td>{formatDateTime(en.createdAt, lang)}</td>
                  {summaryFields.map((f) => (
                    <td key={f.key} dir="auto">
                      {valueText(f, en.values[f.key], yesNo)}
                      {en.corrected.includes(f.key) && <span className="tag cat-handover"> {t('registers.corrected')}</span>}
                    </td>
                  ))}
                  {reg.closeLabels && (
                    <td><span className={en.closedAt ? 'tag' : 'tag inside'}>{en.closedAt ? t('registers.closed') : t('registers.open')}</span></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {opened && (
        <EntryDialog reg={reg} entry={opened} accounts={accounts}
          onClose={() => setOpened(null)}
          onChanged={() => { setOpened(null); load() }} />
      )}
    </div>
  )
}

/** "error.fieldRequired:key" names the field by its label */
function fieldError(err: unknown, reg: RegisterDef, lang: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  const msg = err instanceof Error ? err.message : String(err)
  const m = msg.match(/(error\.\w+):([a-z][a-z0-9_]*)/)
  const f = m ? reg.fields.find((x) => x.key === m[2]) : undefined
  return f && m ? t(m[1], { s: labelOf(f.labels, lang) }) : errorText(err, t as never)
}

function EntryDialog({ reg, entry, accounts, onClose, onChanged }: {
  reg: RegisterDef
  entry: RegisterEntry
  accounts: AccountOption[]
  onClose(): void
  onChanged(): void
}): ReactNode {
  const { t } = useTranslation()
  const { toast, user } = useApp()
  const lang = currentLang()
  const yesNo = useYesNo()
  const [mode, setMode] = useState<'view' | 'close' | 'correct'>('view')
  const [closeValues, setCloseValues] = useState<EntryInputValues>({})
  const [fixKey, setFixKey] = useState('')
  const [fixValue, setFixValue] = useState<FieldInput>('')
  const [reason, setReason] = useState('')
  const [corrections, setCorrections] = useState<EntryCorrection[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (entry.corrected.length) window.api.registers.corrections(entry.id).then(setCorrections)
  }, [entry])

  const isAdmin = user.role === 'admin'
  const canClose = !!reg.closeLabels && !entry.closedAt && (isAdmin || reg.closeRoles.includes(user.role))
  const canCorrect = user.role !== 'guard' || entry.createdBy === user.name
  // closing-step fields only once the entry is closed; switched-off fields only where they hold a value
  const shown = reg.fields.filter((f) => (f.step === 'open' || entry.closedAt) && (f.active || entry.values[f.key] !== undefined))
  const fieldOf = (key: string): RegisterField | undefined => reg.fields.find((f) => f.key === key)

  const run = async (fn: () => Promise<void>, ok: string): Promise<void> => {
    setBusy(true)
    try {
      await fn()
      toast(ok)
      onChanged()
    } catch (err) {
      toast(fieldError(err, reg, lang, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  const close = (e: FormEvent): void => {
    e.preventDefault()
    const miss = missingFields(reg.fields.filter((f) => f.step === 'close'), closeValues)
    if (miss.length) return toast(t('error.fieldRequired', { s: labelOf(miss[0].labels, lang) }), 'error')
    run(() => window.api.registers.close(entry.id, closeValues), labelOf(reg.closeLabels ?? reg.labels, lang))
  }

  const correct = (e: FormEvent): void => {
    e.preventDefault()
    if (!fixKey) return
    run(() => window.api.registers.correct(entry.id, fixKey, fixValue, reason), t('registers.correctDone'))
  }

  const fixField = fieldOf(fixKey)
  return (
    <div className="modal" role="dialog" aria-modal onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="card modal-card wide">
        <div className="section-head">
          <h2>{t('registers.details', { n: entry.number })} · {labelOf(reg.labels, lang)}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')}><Icon name="x" /></button>
        </div>
        <p className="hint">
          {t('registers.recordedBy', { name: entry.createdBy })} · {formatDateTime(entry.createdAt, lang)}
          {entry.closedAt && reg.closeLabels && <> · {t('registers.closedBy', { step: labelOf(reg.closeLabels, lang), name: entry.closedBy ?? '', time: formatDateTime(entry.closedAt, lang) })}</>}
        </p>
        <table className="detail-table">
          <tbody>
            {shown.map((f) => (
              <tr key={f.key}>
                <th>{labelOf(f.labels, lang)}</th>
                <td dir="auto">
                  {valueText(f, entry.values[f.key], yesNo) || <span className="muted">{t('registers.empty')}</span>}
                  {entry.corrected.includes(f.key) && <span className="tag cat-handover"> {t('registers.corrected')}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {corrections.length > 0 && (
          <>
            <h3>{t('registers.corrections')}</h3>
            <ul className="corrections">
              {corrections.map((c, i) => {
                const f = fieldOf(c.fieldKey)
                return (
                  <li key={i}>
                    <strong>{f ? labelOf(f.labels, lang) : c.fieldKey}</strong>{' '}
                    <span dir="auto">« {valueText(f, c.oldValue, yesNo) || t('registers.empty')} » → « {valueText(f, c.newValue, yesNo) || t('registers.empty')} »</span>
                    <span className="muted"> — {c.reason} · {c.by} · {formatDateTime(c.at, lang)}</span>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {mode === 'close' && reg.closeLabels && (
          <form onSubmit={close} className="sub-form">
            <h3>{labelOf(reg.closeLabels, lang)}</h3>
            <FieldInputs fields={reg.fields} step="close" values={closeValues} onChange={setCloseValues} accounts={accounts} />
            <div className="actions">
              <button type="button" onClick={() => setMode('view')}>{t('common.cancel')}</button>
              <button className="primary" disabled={busy}>{labelOf(reg.closeLabels, lang)}</button>
            </div>
          </form>
        )}

        {mode === 'correct' && (
          <form onSubmit={correct} className="sub-form">
            <h3>{t('registers.correctTitle', { n: entry.number })}</h3>
            <label>{t('registers.correctField')}
              <select value={fixKey} onChange={(e) => { setFixKey(e.target.value); setFixValue('') }} required>
                <option value="">{t('registers.pick')}</option>
                {shown.filter((f) => f.type !== 'signature').map((f) => <option key={f.key} value={f.key}>{labelOf(f.labels, lang)}</option>)}
              </select>
            </label>
            {fixField && (
              <div className="field">
                <span className="field-label">{t('registers.correctValue')}</span>
                <FieldInputControl field={fixField} value={fixValue} onChange={setFixValue} accounts={accounts} />
              </div>
            )}
            <label className="req">{t('registers.correctReason')}<input value={reason} onChange={(e) => setReason(e.target.value)} dir="auto" required /></label>
            <div className="actions">
              <button type="button" onClick={() => setMode('view')}>{t('common.cancel')}</button>
              <button className="primary" disabled={busy || !fixKey || !reason.trim()}>{t('registers.correct')}</button>
            </div>
          </form>
        )}

        {mode === 'view' && (
          <div className="actions">
            {canCorrect && <button type="button" onClick={() => setMode('correct')}>{t('registers.correct')}</button>}
            {canClose && reg.closeLabels && <button type="button" className="primary" onClick={() => setMode('close')}>{labelOf(reg.closeLabels, lang)}</button>}
          </div>
        )}
      </div>
    </div>
  )
}
