import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Student, StudentInput, StudentMatch } from '@shared/types'
import { formatDateTime } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import Icon from '../components/Icon'
import PrintButton from '../components/PrintButton'
import { errorText } from '../util'

const EMPTY: StudentInput = { studentNo: '', idNumber: '', fullName: '', fullNameAlt: '', birthDate: '', phone: '', level: '', department: '', notes: '' }

/** The faculty's students: find one by name or number, see whether they are inside, add or import them. */
export default function StudentsPage(): ReactNode {
  const { t } = useTranslation()
  const { toast, user } = useApp()
  const lang = currentLang()
  const canEdit = user.role !== 'guard'
  const [text, setText] = useState('')
  const [inactive, setInactive] = useState(false)
  const [rows, setRows] = useState<StudentMatch[]>([])
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState<StudentInput | null>(null)

  const load = useCallback(() => {
    window.api.students.list({ text, includeInactive: inactive }).then(setRows).catch((e) => toast(errorText(e, t), 'error'))
    window.api.students.count().then(setTotal)
  }, [text, inactive, toast, t])
  useEffect(() => {
    const timer = setTimeout(load, 200)
    return () => clearTimeout(timer)
  }, [load])

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
    load()
  }

  const importFile = (): Promise<void> => run(async () => {
    const r = await window.api.students.import()
    if (r) toast(t('students.importDone', { added: r.added, updated: r.updated, skipped: r.skipped }))
  })
  const template = (): Promise<void> => run(async () => {
    const path = await window.api.students.template(lang)
    if (path) toast(t('export.saved', { path }))
  })

  const presence = (m: StudentMatch): ReactNode => {
    if (m.insideVisitId) return <span className="tag inside">{t('students.inside', { time: formatDateTime(m.insideSince, lang) })}</span>
    if (m.lastSeen) return <span className="muted">{t('students.lastSeen', { date: formatDateTime(m.lastSeen, lang) })}</span>
    return <span className="muted">—</span>
  }

  return (
    <div className="card">
      <div className="section-head">
        <h1>{t('students.title')}</h1>
        <span className="count-pill">{total}</span>
        <div className="head-actions">
          {canEdit && <button type="button" className="primary" onClick={() => setEditing({ ...EMPTY })}><Icon name="user" /> {t('students.add')}</button>}
          {canEdit && <button type="button" onClick={importFile}><Icon name="upload" /> {t('students.import')}</button>}
          {canEdit && <button type="button" onClick={template}>{t('students.template')}</button>}
          <PrintButton run={(l) => window.api.students.pdf({ text, includeInactive: inactive }, l)} disabled={rows.length === 0} />
        </div>
      </div>
      <p className="hint">{t('students.intro')}</p>
      <div className="filters">
        <label className="grow">{t('common.search')}
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('students.searchHelp')} dir="auto" autoFocus />
        </label>
        {canEdit && <label className="check"><input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} /> {t('students.includeInactive')}</label>}
      </div>
      {rows.length === 0 ? <p className="empty">{total === 0 ? t('students.empty') : t('students.none')}</p> : (
        <table className="log-table">
          <thead>
            <tr>
              <th>{t('students.studentNo')}</th><th>{t('students.fullName')}</th><th>{t('students.level')}</th><th>{t('students.department')}</th><th>{t('students.presence')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.student.id} className={m.student.active ? '' : 'disabled'} tabIndex={0} onClick={() => setEditing(m.student)} onKeyDown={(e) => e.key === 'Enter' && setEditing(m.student)}>
                <td className="mono" dir="ltr">{m.student.studentNo}</td>
                <td dir="auto"><strong>{m.student.fullNameAlt || m.student.fullName}</strong>{m.student.fullNameAlt && m.student.fullName && <small className="muted"> · {m.student.fullName}</small>}</td>
                <td>{m.student.level}</td>
                <td dir="auto">{m.student.department}</td>
                <td>{presence(m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && <StudentDialog initial={editing} canEdit={canEdit} onClose={(saved) => { setEditing(null); if (saved) load() }} />}
    </div>
  )
}

function StudentDialog({ initial, canEdit, onClose }: { initial: StudentInput | Student; canEdit: boolean; onClose(saved: boolean): void }): ReactNode {
  const { t } = useTranslation()
  const { toast, user } = useApp()
  const [s, setS] = useState<StudentInput>({ ...initial })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof StudentInput, v: string | boolean): void => setS((cur) => ({ ...cur, [k]: v }))
  const field = (k: Exclude<keyof StudentInput, 'id' | 'active'>, label: string, extra: { dir?: 'ltr' | 'auto'; type?: string; required?: boolean } = {}): ReactNode => (
    <label className={extra.required ? 'req' : ''}>{label}
      <input type={extra.type ?? 'text'} value={s[k] ?? ''} onChange={(e) => set(k, e.target.value)} dir={extra.dir ?? 'auto'} disabled={!canEdit} />
    </label>
  )
  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    try {
      await window.api.students.save(s)
      toast(t('students.saved'))
      onClose(true)
    } catch (err) {
      toast(errorText(err, t), 'error')
    } finally {
      setBusy(false)
    }
  }
  const remove = async (): Promise<void> => {
    if (!s.id || !window.confirm(t('students.deleteConfirm'))) return
    try {
      await window.api.students.remove(s.id)
      onClose(true)
    } catch (err) {
      toast(errorText(err, t), 'error')
    }
  }
  return (
    <div className="modal" role="dialog" aria-modal onKeyDown={(e) => e.key === 'Escape' && onClose(false)}>
      <form className="card modal-card wide" onSubmit={submit}>
        <div className="section-head">
          <h2>{s.id ? t('students.edit') : t('students.add')}</h2>
          <button type="button" onClick={() => onClose(false)} aria-label={t('common.close')}><Icon name="x" /></button>
        </div>
        <div className="row2">
          {field('fullNameAlt', t('students.fullNameAlt'))}
          {field('fullName', t('students.fullName'))}
        </div>
        <div className="row2">
          {field('studentNo', t('students.studentNo'), { dir: 'ltr' })}
          {canEdit && field('idNumber', t('students.idNumber'), { dir: 'ltr' })}
        </div>
        <div className="row2">
          {field('level', t('students.level'))}
          {field('department', t('students.department'))}
        </div>
        {canEdit && (
          <div className="row2">
            {field('birthDate', t('students.birthDate'), { type: 'date', dir: 'ltr' })}
            {field('phone', t('students.phone'), { dir: 'ltr' })}
          </div>
        )}
        <label>{t('students.notes')}<textarea rows={2} value={s.notes} onChange={(e) => set('notes', e.target.value)} dir="auto" disabled={!canEdit} /></label>
        {canEdit && s.id && (
          <label className="check"><input type="checkbox" checked={s.active !== false} onChange={(e) => set('active', e.target.checked)} /> {t('students.active')}</label>
        )}
        <div className="actions">
          {canEdit && s.id && user.role === 'admin' && <button type="button" onClick={remove}>{t('students.delete')}</button>}
          <button type="button" onClick={() => onClose(false)}>{t('common.cancel')}</button>
          {canEdit && <button className="primary" disabled={busy}>{t('common.save')}</button>}
        </div>
      </form>
    </div>
  )
}
