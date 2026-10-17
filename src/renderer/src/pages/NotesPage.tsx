import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { NoteCategory, NoteRow } from '@shared/types'
import { formatTime } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import { errorText, todayStr } from '../util'

const CATEGORIES: NoteCategory[] = ['general', 'patrol', 'alarm', 'maintenance']

export default function NotesPage(): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [category, setCategory] = useState<NoteCategory>('general')
  const [text, setText] = useState('')
  const [notes, setNotes] = useState<NoteRow[]>([])
  const lang = currentLang()

  const load = useCallback(() => {
    window.api.notes.list(todayStr(), todayStr()).then(setNotes)
  }, [])
  useEffect(load, [load])

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    try {
      await window.api.notes.add(category, text)
      setText('')
      toast(t('notes.added'))
      load()
    } catch (err) {
      toast(errorText(err, t), 'error')
    }
  }

  return (
    <div className="notes-page">
      <form className="card" onSubmit={submit}>
        <h1>{t('notes.title')}</h1>
        <div className="seg" role="radiogroup" aria-label={t('notes.category')}>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={category === c}
              className={`seg-btn cat-${c} ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>
              {t(`notes.cat.${c}`)}
            </button>
          ))}
        </div>
        <label>{t('notes.text')}
          <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} dir="auto" autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) (e.currentTarget.form as HTMLFormElement).requestSubmit() }} />
        </label>
        <div className="actions">
          <span className="hint">Ctrl + Enter</span>
          <button className="primary big" disabled={!text.trim()}>{t('notes.add')}</button>
        </div>
      </form>

      <section className="card">
        <h2>{t('notes.recent')}</h2>
        {notes.length === 0 ? <p className="empty">–</p> : (
          <ul className="note-list">
            {notes.map((n) => (
              <li key={n.id}>
                <div className="note-meta">
                  <strong>{formatTime(n.time, lang)}</strong>
                  <span className={`tag cat-${n.category}`}>{t(`notes.cat.${n.category}`)}</span>
                  <span className="muted">{n.guard}</span>
                </div>
                <p dir="auto">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
