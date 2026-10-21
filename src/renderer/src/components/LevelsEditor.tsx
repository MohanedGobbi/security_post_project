import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Labels, Level, LevelInput, Permission } from '@shared/types'
import { PERMISSIONS } from '@shared/permissions'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import { levelName } from '../levels'
import { errorText } from '../util'

const EMPTY: LevelInput = { labels: { ar: '', en: '', fr: '' }, permissions: ['visitors', 'students'] }
const LANGS: (keyof Labels)[] = ['ar', 'fr', 'en']

/** Administration → Accounts: the permission levels. Each account has one; each register says which levels fill and close it. */
export default function LevelsEditor({ levels, onChanged }: { levels: Level[]; onChanged(): void }): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const lang = currentLang()
  const [editing, setEditing] = useState<LevelInput | null>(null)

  const remove = async (l: Level): Promise<void> => {
    if (!window.confirm(t('levels.deleteConfirm', { name: levelName(levels, l.key, lang) }))) return
    try {
      await window.api.levels.remove(l.key)
      onChanged()
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }

  return (
    <section className="card">
      <div className="section-head">
        <h2>{t('levels.title')}</h2>
        <button type="button" className="primary" onClick={() => setEditing({ ...EMPTY, labels: { ...EMPTY.labels } })}>{t('levels.add')}</button>
      </div>
      <p className="hint">{t('levels.intro')}</p>
      <table className="log-table">
        <thead><tr><th>{t('levels.name')}</th><th>{t('levels.allows')}</th><th>{t('levels.accounts')}</th><th /></tr></thead>
        <tbody>
          {levels.map((l) => (
            <tr key={l.key}>
              <td><strong>{levelName(levels, l.key, lang)}</strong>{l.builtin && <small className="muted"> · {t('levels.builtin')}</small>}</td>
              <td className="muted">{l.key === 'admin' ? t('levels.everything') : l.permissions.map((p) => t(`levels.perm.${p}`)).join(' · ') || '—'}</td>
              <td>{l.users}</td>
              <td className="row-actions">
                {l.key !== 'admin' && <button type="button" onClick={() => setEditing({ key: l.key, labels: { ...l.labels }, permissions: [...l.permissions] })}>{t('builder.edit')}</button>}
                {!l.builtin && <button type="button" disabled={l.users > 0} title={l.users > 0 ? t('levels.inUse') : ''} onClick={() => remove(l)}>{t('students.delete')}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && <LevelDialog initial={editing} onClose={(saved) => { setEditing(null); if (saved) onChanged() }} />}
    </section>
  )
}

function LevelDialog({ initial, onClose }: { initial: LevelInput; onClose(saved: boolean): void }): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [d, setD] = useState<LevelInput>(initial)
  const [busy, setBusy] = useState(false)
  const toggle = (p: Permission, on: boolean): void => setD((cur) => ({ ...cur, permissions: on ? [...cur.permissions, p] : cur.permissions.filter((x) => x !== p) }))
  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    try {
      await window.api.levels.save(d)
      toast(t('settings.saved'))
      onClose(true)
    } catch (err) {
      toast(errorText(err, t), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="modal" role="dialog" aria-modal onKeyDown={(e) => e.key === 'Escape' && onClose(false)}>
      <form className="card modal-card wide" onSubmit={submit}>
        <h2>{initial.key ? t('levels.edit') : t('levels.add')}</h2>
        <div className="row3">
          {LANGS.map((l) => (
            <label key={l}>{t('levels.name')} · {t(`lang.${l}`)}
              <input value={d.labels[l]} onChange={(e) => setD({ ...d, labels: { ...d.labels, [l]: e.target.value } })} dir={l === 'ar' ? 'rtl' : 'ltr'} autoFocus={l === 'ar'} />
            </label>
          ))}
        </div>
        <h3>{t('levels.allows')}</h3>
        <ul className="perm-list">
          {PERMISSIONS.map((p) => (
            <li key={p}>
              <label className="check">
                <input type="checkbox" checked={d.permissions.includes(p)} onChange={(e) => toggle(p, e.target.checked)} />
                <span><strong>{t(`levels.perm.${p}`)}</strong><small className="muted"> — {t(`levels.permHelp.${p}`)}</small></span>
              </label>
            </li>
          ))}
        </ul>
        <p className="hint">{t('levels.registersHelp')}</p>
        <div className="actions">
          <button type="button" onClick={() => onClose(false)}>{t('common.cancel')}</button>
          <button className="primary" disabled={busy}>{t('common.save')}</button>
        </div>
      </form>
    </div>
  )
}
