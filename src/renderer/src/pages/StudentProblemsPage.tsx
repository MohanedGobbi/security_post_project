import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { FieldCheck, QrCheck, RegisterDef, RegisterEntry, StudentCheck } from '@shared/types'
import { formatDateTime } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import Icon from '../components/Icon'
import QrScanner from '../components/QrScanner'
import { errorText, todayStr } from '../util'

/** the choices of the register's select fields (src/shared/registerTemplates.ts), stored as written there */
const PROBLEMS = { forgot: 'نسي بطاقته', lost: 'فقد بطاقته', other: 'أخرى' } as const
const CHECKED_BY = { qr: 'البطاقة الرقمية (QR)', search: 'البحث في قائمة الطلبة' } as const
const RESULTS = { match: 'مطابق لقائمة الطلبة', mismatch: 'غير مطابق', notFound: 'غير موجود في القائمة' } as const
type Problem = keyof typeof PROBLEMS
type Verdict = keyof typeof RESULTS

const FIELD_LABEL: Record<FieldCheck['key'], string> = {
  studentNo: 'students.studentNo', fullName: 'problems.name', birthDate: 'students.birthDate', level: 'students.level', department: 'students.department'
}

const verdictOf = (method: 'qr' | 'search', c: StudentCheck | null): Verdict => {
  if (!c) return 'notFound'
  if (method === 'search') return 'match'
  return c.fields.some((f) => f.same === false) ? 'mismatch' : 'match'
}

const yesterday = (): string => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

/**
 * A student who forgot or lost their card shows the digital card on their phone: its QR is read as text and compared with the
 * student directory, then the guard records the problem in the student problems register.
 */
export default function StudentProblemsPage(): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const lang = currentLang()
  const [register, setRegister] = useState<RegisterDef | null | undefined>(undefined)
  const [scanning, setScanning] = useState(true)
  const [method, setMethod] = useState<'qr' | 'search'>('qr')
  const [qr, setQr] = useState<QrCheck | null>(null)
  const [selected, setSelected] = useState<StudentCheck | null>(null)
  const [text, setText] = useState('')
  const [found, setFound] = useState<StudentCheck[]>([])
  const [studentNo, setStudentNo] = useState('')
  const [name, setName] = useState('')
  const [problem, setProblem] = useState<Problem>('forgot')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [recent, setRecent] = useState<RegisterEntry[]>([])

  const loadRecent = useCallback((reg: RegisterDef) => {
    window.api.registers.entries({ registerId: reg.id, from: yesterday(), to: todayStr(), text: '', openOnly: false })
      .then((es) => setRecent(es.slice(0, 8))).catch(() => setRecent([]))
  }, [])

  useEffect(() => {
    window.api.registers.list().then((rs) => {
      const reg = rs.find((r) => r.key === 'student_problems' && r.active) ?? null
      setRegister(reg)
      if (reg) loadRecent(reg)
    }).catch(() => setRegister(null))
  }, [loadRecent])

  const choose = (c: StudentCheck | null): void => {
    setSelected(c)
    setStudentNo(c?.student.studentNo ?? qr?.found.studentNo ?? '')
    setName(c ? c.student.fullNameAlt || c.student.fullName : qr?.found.fullName ?? '')
  }

  const onCode = async (code: string): Promise<void> => {
    setScanning(false)
    try {
      const r = await window.api.studentProblems.checkQr(code)
      setQr(r)
      setMethod('qr')
      setSelected(r.matches[0] ?? null)
      setStudentNo(r.matches[0]?.student.studentNo ?? r.found.studentNo)
      setName(r.matches[0] ? r.matches[0].student.fullNameAlt || r.matches[0].student.fullName : r.found.fullName)
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }

  // search by name or card number, for when the QR cannot be read
  useEffect(() => {
    if (text.trim().length < 2) { setFound([]); return }
    const timer = setTimeout(() => {
      window.api.studentProblems.search(text).then(setFound).catch(() => setFound([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [text])

  const pickFound = (c: StudentCheck): void => {
    setQr(null)
    setMethod('search')
    setScanning(false)
    setFound([])
    setText('')
    setSelected(c)
    setStudentNo(c.student.studentNo)
    setName(c.student.fullNameAlt || c.student.fullName)
  }

  const reset = (): void => {
    setQr(null); setSelected(null); setStudentNo(''); setName(''); setNote(''); setProblem('forgot'); setMethod('qr'); setScanning(true)
  }

  const verdict = verdictOf(method, selected)
  const shown = !!qr || (method === 'search' && !!selected)

  const save = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!register) return
    if (!studentNo.trim() || !name.trim()) return toast(t('problems.needStudent'), 'error')
    setBusy(true)
    try {
      const s = selected?.student
      const r = await window.api.registers.add(register.id, {
        student_no: studentNo.trim(),
        student_name: name.trim(),
        level_department: s ? [s.level, s.department].filter(Boolean).join(' · ') : '',
        problem: PROBLEMS[problem],
        checked_by: CHECKED_BY[method],
        result: RESULTS[verdict],
        qr_text: method === 'qr' ? qr?.text ?? '' : '',
        notes: note.trim()
      })
      toast(t('registers.recorded', { n: r.number }))
      loadRecent(register)
      reset()
    } catch (err) {
      toast(errorText(err, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (register === null) return <section className="card"><h1>{t('problems.title')}</h1><p className="banner warn">{t('problems.noRegister')}</p></section>

  return (
    <div className="visitor-in problems-page">
      <section className="card">
        <h1>{t('problems.title')}</h1>
        <p className="muted">{t('problems.intro')}</p>
        {scanning ? (
          <QrScanner onCode={onCode} onClose={() => setScanning(false)} hint={t('problems.scanHint')} />
        ) : (
          <button type="button" className="primary big" onClick={reset}><Icon name="qr" /> {qr || selected ? t('problems.scanAgain') : t('problems.scan')}</button>
        )}
        <label className="problems-search">{t('problems.searchLabel')}
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('students.searchHelp')} dir="auto" />
        </label>
        {found.length > 0 && (
          <ul className="pick-list">
            {found.map((c) => (
              <li key={c.student.id}>
                <button type="button" onClick={() => pickFound(c)}>
                  <strong dir="auto">{c.student.fullNameAlt || c.student.fullName}</strong>
                  <span className="muted" dir="auto">{[c.student.level, c.student.department].filter(Boolean).join(' · ')}</span>
                  <span className="mono ref">{c.student.studentNo}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {register && (
          <>
            <h2 className="problems-recent-title">{t('problems.recent')}</h2>
            {recent.length === 0 ? <p className="empty">{t('problems.none')}</p> : (
              <table className="log-table compact">
                <tbody>
                  {recent.map((e) => (
                    <tr key={e.id}>
                      <td className="mono">{formatDateTime(e.createdAt, lang)}</td>
                      <td dir="auto">{String(e.values.student_name ?? '')}</td>
                      <td dir="auto">{String(e.values.problem ?? '')}</td>
                      <td dir="auto" className="muted">{e.createdBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>

      <form className="card visitor-form" onSubmit={save}>
        {!shown ? (
          <div className="problems-empty"><Icon name="qr" size={48} /><p>{t('problems.waiting')}</p></div>
        ) : (
          <>
            <div className={`banner ${verdict === 'match' ? 'ok' : verdict === 'mismatch' ? 'warn' : 'error'}`}>
              <Icon name={verdict === 'match' ? 'user' : 'alert'} /> {t(`problems.verdict.${verdict}`)}
              {selected?.by === 'name' && method === 'qr' && <> · {t('problems.byName')}</>}
            </div>
            {qr && qr.matches.length > 1 && (
              <div className="chips">
                {qr.matches.map((m) => (
                  <button key={m.student.id} type="button" className={selected?.student.id === m.student.id ? 'chip on' : 'chip'} dir="auto" onClick={() => choose(m)}>
                    {m.student.fullNameAlt || m.student.fullName} · {m.student.studentNo}
                  </button>
                ))}
              </div>
            )}
            {selected && selected.recentProblems > 0 && (
              <div className="banner warn"><Icon name="alert" /> {t('problems.repeat', { n: selected.recentProblems })}</div>
            )}
            {selected && method === 'qr' && (
              <table className="log-table compare">
                <thead><tr><th>{t('problems.field')}</th><th>{t('problems.fromQr')}</th><th>{t('problems.inList')}</th><th /></tr></thead>
                <tbody>
                  {selected.fields.map((f) => (
                    <tr key={f.key} className={f.same === false ? 'bad' : ''}>
                      <td>{t(FIELD_LABEL[f.key])}</td>
                      <td dir="auto">{f.fromQr || <span className="muted">{t('problems.notInQr')}</span>}</td>
                      <td dir="auto">{f.inList}</td>
                      <td>{f.same === true ? '✓' : f.same === false ? '✗' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {selected && method === 'search' && (
              <div className="banner info" dir="auto">
                <strong>{selected.student.fullNameAlt || selected.student.fullName}</strong>
                {' · '}{[selected.student.studentNo, selected.student.level, selected.student.department].filter(Boolean).join(' · ')}
              </div>
            )}
            {qr && (
              <details className="qr-text">
                <summary>{t('problems.qrText')}</summary>
                <pre dir="auto">{qr.text}</pre>
              </details>
            )}
            {!selected && <p className="hint">{t('problems.manual')}</p>}
            <div className="row2">
              <label className="req">{t('students.studentNo')}<input value={studentNo} onChange={(e) => setStudentNo(e.target.value)} dir="ltr" className="mono" /></label>
              <label className="req">{t('problems.name')}<input value={name} onChange={(e) => setName(e.target.value)} dir="auto" /></label>
            </div>
            <fieldset className="problem-choice">
              <legend>{t('problems.problem')}</legend>
              {(Object.keys(PROBLEMS) as Problem[]).map((p) => (
                <button key={p} type="button" className={problem === p ? 'chip on' : 'chip'} onClick={() => setProblem(p)}>{t(`problems.${p}`)}</button>
              ))}
            </fieldset>
            <label>{t('problems.note')}<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} dir="auto" /></label>
            <div className="actions sticky">
              <button type="button" onClick={reset}>{t('common.cancel')}</button>
              <button className="primary big" disabled={busy || !register}><Icon name="book" /> {t('problems.record')}</button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
