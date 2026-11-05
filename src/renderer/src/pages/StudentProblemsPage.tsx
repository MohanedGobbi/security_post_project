import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { FieldCheck, QrCheck, RegisterDef, RegisterEntry, StudentCheck } from '@shared/types'
import { formatDateTime } from '@shared/i18n'
import { cardCodes, looksLikeLink } from '@shared/studentQr'
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

const verdictOf = (c: StudentCheck | null): Verdict => {
  if (!c) return 'notFound'
  return c.fields.some((f) => f.same === false) ? 'mismatch' : 'match'
}

/** what a scanner typed (or a guard pasted): a code to check, not a name to search */
const isCode = (text: string): boolean => {
  const v = text.trim()
  return looksLikeLink(v) || cardCodes(v).length > 0 || /^\d{6,}$/.test(v) || v.startsWith('{')
}

const yesterday = (): string => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

/** the US keyboard's characters of the keys that are not letters or digits: [plain, with Shift] */
const US_KEYS: Record<string, [string, string]> = {
  Minus: ['-', '_'], Equal: ['=', '+'], BracketLeft: ['[', '{'], BracketRight: [']', '}'], Backslash: ['\\', '|'], Semicolon: [';', ':'],
  Quote: ["'", '"'], Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'], Backquote: ['`', '~'], Space: [' ', ' '],
  NumpadDivide: ['/', '/'], NumpadSubtract: ['-', '-'], NumpadAdd: ['+', '+'], NumpadDecimal: ['.', '.'], NumpadMultiply: ['*', '*']
}
const US_DIGIT_SHIFT = ')!@#$%^&*('

/**
 * The character a key gives on a US keyboard, whatever keyboard the PC is set to. A USB code reader "types" as a US keyboard:
 * with the Arabic or French layout on, the system turns its keys into other characters (a link arrives as Arabic letters, or
 * "&é"'(" instead of digits). Rebuilding the text from the keys pressed gives back what the reader read.
 */
function usChar(e: { code: string; shiftKey: boolean }): string {
  if (e.code.startsWith('Key')) return e.shiftKey ? e.code.slice(3) : e.code.slice(3).toLowerCase()
  if (e.code.startsWith('Digit')) return e.shiftKey ? US_DIGIT_SHIFT[Number(e.code.slice(5))] : e.code.slice(5)
  if (/^Numpad\d$/.test(e.code)) return e.code.slice(6)
  return US_KEYS[e.code]?.[e.shiftKey ? 1 : 0] ?? ''
}

/** keys typed this fast, one after the other, come from a reader, not from a person */
const READER_MS_PER_KEY = 35

/**
 * A student who forgot or lost their card shows the digital card on their phone. Its QR is read by the webcam, or typed into the
 * scan field by a handheld reader (it always has the focus), compared with the student directory, and the guard records the
 * problem in the student problems register. Then the page clears itself for the next student.
 */
export default function StudentProblemsPage(): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const lang = currentLang()
  const field = useRef<HTMLInputElement>(null)
  const [register, setRegister] = useState<RegisterDef | null | undefined>(undefined)
  const [camera, setCamera] = useState(true)
  const [qr, setQr] = useState<QrCheck | null>(null)
  /** the student shown: from the QR, or picked in the search */
  const [selected, setSelected] = useState<StudentCheck | null>(null)
  const [picked, setPicked] = useState(false)
  const [text, setText] = useState('')
  const [found, setFound] = useState<StudentCheck[]>([])
  const [studentNo, setStudentNo] = useState('')
  const [name, setName] = useState('')
  const [problem, setProblem] = useState<Problem>('forgot')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [recent, setRecent] = useState<RegisterEntry[]>([])

  const focusField = useCallback(() => setTimeout(() => field.current?.focus(), 0), [])
  /** what the keys typed into the scan field give on a US keyboard, with the time of each key */
  const keys = useRef<{ text: string; times: number[] }>({ text: '', times: [] })
  const clearKeys = (): void => { keys.current = { text: '', times: [] } }
  const recordKey = (e: { key: string; code: string; shiftKey: boolean }): void => {
    if (e.key === 'Enter') return
    if (e.key === 'Backspace') { keys.current.text = keys.current.text.slice(0, -1); return }
    const us = usChar(e)
    if (!us) return
    // the same key as on a US keyboard: the character typed is right (its case too); otherwise the US one
    keys.current.text += e.key.length === 1 && e.key.toLowerCase() === us.toLowerCase() ? e.key : us
    keys.current.times.push(performance.now())
  }
  /** the reader's text rebuilt from its keys, when the keys came at a reader's speed */
  const fromReader = (): string => {
    const { text: k, times } = keys.current
    if (times.length < 8) return ''
    return (times[times.length - 1] - times[0]) / (times.length - 1) <= READER_MS_PER_KEY ? k : ''
  }

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

  // a handheld reader types like a keyboard: whatever is focused elsewhere, its keys go to the scan field
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent): void => {
      const el = document.activeElement as HTMLElement | null
      const typing = el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)
      if (!typing && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // this first key reaches the field after the focus moves, but not its key handler: note it here
        if (!field.current?.value) clearKeys()
        recordKey(e)
        field.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const show = (c: StudentCheck | null, r: QrCheck | null): void => {
    setSelected(c)
    setStudentNo(c?.student.studentNo ?? r?.found.studentNo ?? '')
    setName(c ? c.student.fullNameAlt || c.student.fullName : r?.found.fullName ?? '')
  }

  /** a code from the webcam or the scan field */
  const onCode = async (code: string): Promise<void> => {
    const v = code.trim()
    if (!v) return
    setText('')
    setFound([])
    setCamera(false)
    try {
      const r = await window.api.studentProblems.checkQr(v)
      setQr(r)
      setPicked(false)
      show(r.matches[0] ?? null, r)
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
    focusField()
  }

  // a typed name or number: the directory is searched as it is typed
  useEffect(() => {
    if (text.trim().length < 2 || looksLikeLink(text) || cardCodes(text).length) { setFound([]); return }
    const timer = setTimeout(() => {
      window.api.studentProblems.search(text).then(setFound).catch(() => setFound([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [text])

  const onFieldKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (!e.currentTarget.value) clearKeys()
    if (e.key !== 'Enter') { recordKey(e); return }
    e.preventDefault()
    // readers end a code with Enter. What a reader typed is taken from its keys (right whatever the keyboard language);
    // for a typed search, Enter takes the only (or first) student found
    const read = fromReader()
    clearKeys()
    if (read && isCode(read)) onCode(read)
    else if (isCode(text)) onCode(text)
    else if (found.length) pickFound(found[0])
  }

  /** a student picked in the search; a QR whose code was not known stays, so its code is learnt when the problem is recorded */
  const pickFound = (c: StudentCheck): void => {
    setFound([])
    setText('')
    setCamera(false)
    setPicked(true)
    show(c, qr)
    focusField()
  }

  const reset = (): void => {
    setQr(null); setSelected(null); setPicked(false); setStudentNo(''); setName(''); setNote(''); setProblem('forgot')
    setText(''); setFound([]); setCamera(true)
    focusField()
  }

  const verdict = picked ? 'match' : verdictOf(selected)
  const shown = !!qr || !!selected
  /** the QR gave a code no student has yet: learnt for the student the guard picks */
  const newCode = qr && qr.code && !qr.matches.some((m) => m.by === 'code') ? qr.code : ''
  const hasFields = !!selected && !picked && selected.fields.some((f) => f.same !== null)

  const save = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!register) return
    if (!studentNo.trim() || !name.trim()) return toast(t('problems.needStudent'), 'error')
    setBusy(true)
    try {
      const s = selected?.student
      if (s && newCode) await window.api.studentProblems.learnCode(s.id, newCode)
      const r = await window.api.registers.add(register.id, {
        student_no: studentNo.trim(),
        student_name: name.trim(),
        level_department: s ? [s.level, s.department].filter(Boolean).join(' · ') : '',
        problem: PROBLEMS[problem],
        checked_by: qr ? CHECKED_BY.qr : CHECKED_BY.search,
        result: RESULTS[verdict],
        qr_text: qr?.text ?? '',
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
        <label className="scan-field">{t('problems.fieldLabel')}
          <input ref={field} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onFieldKey}
            placeholder={t('problems.fieldPlaceholder')} dir="auto" autoFocus autoComplete="off" spellCheck={false} />
        </label>
        <p className="hint">{t('problems.fieldHint')}</p>
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
        {camera ? (
          <QrScanner onCode={onCode} onClose={() => { setCamera(false); focusField() }} hint={t('problems.scanHint')} />
        ) : (
          <button type="button" onClick={() => { setCamera(true); focusField() }}><Icon name="camera" /> {t('problems.useCamera')}</button>
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
              {selected?.by === 'code' && !picked && <> · {t('problems.byCode')}</>}
              {selected?.by === 'name' && !picked && qr && <> · {t('problems.byName')}</>}
            </div>
            {newCode && !selected && <div className="banner info"><Icon name="qr" /> {t('problems.newCode')}</div>}
            {newCode && selected && <div className="banner info"><Icon name="qr" /> {t('problems.willLearn')}</div>}
            {qr && qr.matches.length > 1 && (
              <div className="chips">
                {qr.matches.map((m) => (
                  <button key={m.student.id} type="button" className={selected?.student.id === m.student.id ? 'chip on' : 'chip'} dir="auto" onClick={() => show(m, qr)}>
                    {m.student.fullNameAlt || m.student.fullName} · {m.student.studentNo}
                  </button>
                ))}
              </div>
            )}
            {selected && selected.recentProblems > 0 && (
              <div className="banner warn"><Icon name="alert" /> {t('problems.repeat', { n: selected.recentProblems })}</div>
            )}
            {hasFields && selected && (
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
            {selected && !hasFields && (
              <div className="banner info student-card" dir="auto">
                <strong>{selected.student.fullNameAlt || selected.student.fullName}</strong>
                {selected.student.fullNameAlt && selected.student.fullName && <span> · {selected.student.fullName}</span>}
                <br />{[selected.student.studentNo, selected.student.level, selected.student.department, selected.student.birthDate].filter(Boolean).join(' · ')}
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
