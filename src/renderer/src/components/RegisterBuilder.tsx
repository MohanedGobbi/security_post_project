import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  REGISTER_FIELD_TYPES, type EntryInputValues, type Labels, type RegisterDef, type RegisterDefInput, type RegisterField,
  type RegisterFieldType, type Role
} from '@shared/types'
import { labelOf } from '@shared/registers'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import Icon, { REGISTER_ICONS, registerIcon } from './Icon'
import { Switch } from './FeaturesSettings'
import { FieldInputs, type AccountOption } from './RegisterFields'
import { errorText } from '../util'

const ROLES: Role[] = ['guard', 'leader', 'admin']
const LANGS: (keyof Labels)[] = ['ar', 'fr', 'en']
const emptyLabels = (): Labels => ({ ar: '', en: '', fr: '' })

/** Administration → Registers: the list (order, on/off) and the editor of one register. */
export default function RegisterBuilder(): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [regs, setRegs] = useState<RegisterDef[]>([])
  const [editing, setEditing] = useState<RegisterDef | 'new' | null>(null)
  const lang = currentLang()

  const load = useCallback(() => {
    window.api.registers.list().then(setRegs)
  }, [])
  useEffect(load, [load])

  const save = async (defs: RegisterDefInput[]): Promise<void> => {
    try {
      for (const d of defs) await window.api.registers.save(d)
      toast(t('settings.saved'))
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
    load()
  }

  /** the tiles follow this order; sort values are renumbered so they stay distinct */
  const move = (i: number, by: -1 | 1): void => {
    const j = i + by
    if (j < 0 || j >= regs.length) return
    const a = regs[i]
    const b = regs[j]
    // the two swap their places; only when they share a value is everything renumbered
    if (a.sort !== b.sort) return void save([{ ...a, sort: b.sort }, { ...b, sort: a.sort }])
    const order = [...regs]
    ;[order[i], order[j]] = [order[j], order[i]]
    save(order.map((r, k) => ({ ...r, sort: (k + 1) * 10 })))
  }

  if (editing) {
    return <RegisterEditor initial={editing === 'new' ? null : editing} nextSort={(regs.length + 1) * 10}
      onClose={(saved) => { setEditing(null); if (saved) load() }} />
  }

  return (
    <section className="card">
      <div className="section-head">
        <h2>{t('admin.registers')}</h2>
        <button type="button" className="primary" onClick={() => setEditing('new')}><Icon name="book" /> {t('builder.new')}</button>
      </div>
      <p className="hint">{t('builder.intro')}</p>
      <ul className="builder-list">
        {regs.map((r, i) => (
          <li key={r.id} className={r.active ? '' : 'off'}>
            <span className="tile-icon"><Icon name={registerIcon(r.icon)} size={20} /></span>
            <span className="grow">
              <strong>{labelOf(r.labels, lang)}</strong>
              <small className="muted">
                {r.fields.filter((f) => f.active).length} · {t('builder.fields')}
                {r.closeLabels && <> · {labelOf(r.closeLabels, lang)}</>}
              </small>
            </span>
            <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('builder.moveUp')} title={t('builder.moveUp')}>▲</button>
            <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={i === regs.length - 1} aria-label={t('builder.moveDown')} title={t('builder.moveDown')}>▼</button>
            <Switch on={r.active} onChange={() => save([{ ...r, active: !r.active }])} name="" desc={t(r.active ? 'settings.active' : 'settings.inactive')} />
            <button type="button" onClick={() => setEditing(r)}>{t('builder.edit')}</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Names in the three languages: the current one first, the others folded away. */
function LabelInputs({ value, onChange, label }: { value: Labels; onChange(v: Labels): void; label: string }): ReactNode {
  const { t } = useTranslation()
  const lang = (LANGS.includes(currentLang() as keyof Labels) ? currentLang() : 'ar') as keyof Labels
  const [more, setMore] = useState(false)
  const others = LANGS.filter((l) => l !== lang)
  return (
    <div className="label-inputs">
      <label>{label}
        <input value={value[lang]} onChange={(e) => onChange({ ...value, [lang]: e.target.value })} dir="auto" />
      </label>
      <button type="button" className="link" onClick={() => setMore(!more)} aria-expanded={more}>
        {more ? '▾' : '▸'} {t('builder.otherLangs')}
      </button>
      {more && (
        <div className="row2">
          {others.map((l) => (
            <label key={l}>{t(`lang.${l}`)}
              <input value={value[l]} onChange={(e) => onChange({ ...value, [l]: e.target.value })} dir={l === 'ar' ? 'rtl' : 'ltr'} />
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function RoleChecks({ value, onChange }: { value: Role[]; onChange(v: Role[]): void }): ReactNode {
  const { t } = useTranslation()
  return (
    <div className="chips">
      {ROLES.map((r) => (
        <label key={r} className="check">
          <input type="checkbox" checked={value.includes(r)} onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))} />
          {t(`settings.roles.${r}`)}
        </label>
      ))}
    </div>
  )
}

/** a key nobody types: fields of a new register are f1, f2… and stay stable afterwards */
const nextFieldKey = (fields: RegisterField[]): string => {
  let n = fields.length + 1
  while (fields.some((f) => f.key === `f${n}`)) n++
  return `f${n}`
}

function RegisterEditor({ initial, nextSort, onClose }: { initial: RegisterDef | null; nextSort: number; onClose(saved: boolean): void }): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const lang = currentLang()
  const [draft, setDraft] = useState<RegisterDefInput>(() => initial
    ? structuredClone({ ...initial })
    : {
        key: `custom_${Date.now().toString(36)}`, labels: emptyLabels(), icon: 'book', fillRoles: ['guard', 'leader', 'admin'], closeRoles: [],
        closeLabels: null, sort: nextSort, active: true,
        fields: [{ key: 'f1', labels: emptyLabels(), type: 'text', options: [], required: true, sensitive: false, step: 'open', active: true }]
      })
  // fields already saved keep their type and encryption (main process rule)
  const savedKeys = useMemo(() => new Set(initial?.fields.map((f) => f.key) ?? []), [initial])
  const [open, setOpen] = useState<string | null>(initial ? null : 'f1')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<EntryInputValues>({})
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  useEffect(() => {
    window.api.registers.accounts().then(setAccounts)
  }, [])

  const set = (patch: Partial<RegisterDefInput>): void => setDraft((d) => ({ ...d, ...patch }))
  const setField = (key: string, patch: Partial<RegisterField>): void =>
    setDraft((d) => ({ ...d, fields: d.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) }))
  const moveField = (i: number, by: -1 | 1): void => setDraft((d) => {
    const j = i + by
    if (j < 0 || j >= d.fields.length) return d
    const fields = [...d.fields]
    ;[fields[i], fields[j]] = [fields[j], fields[i]]
    return { ...d, fields }
  })
  const addField = (): void => {
    const key = nextFieldKey(draft.fields)
    setDraft((d) => ({ ...d, fields: [...d.fields, { key, labels: emptyLabels(), type: 'text', options: [], required: false, sensitive: false, step: 'open', active: true }] }))
    setOpen(key)
  }
  const hasClose = !!draft.closeLabels

  const submit = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.registers.save({
        ...draft,
        // a register without a closing step has no closing fields or closers
        closeRoles: hasClose ? draft.closeRoles : [],
        fields: draft.fields.map((f) => (hasClose ? f : { ...f, step: 'open' }))
      })
      toast(t('builder.saved'))
      onClose(true)
    } catch (e) {
      toast(errorText(e, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  const fieldTitle = (f: RegisterField): string => labelOf(f.labels, lang) || t('builder.newField')
  const shownDef = draft.fields.filter((f) => f.active)

  return (
    <div className="split-page builder">
      <section className="card">
        <button type="button" className="link" onClick={() => onClose(false)}>← {t('admin.registers')}</button>
        <h2>{initial ? t('builder.editTitle') : t('builder.newTitle')}</h2>

        <LabelInputs label={t('builder.names')} value={draft.labels} onChange={(labels) => set({ labels })} />

        <div className="field-group" role="group" aria-label={t('builder.icon')}>
          <span className="field-label">{t('builder.icon')}</span>
          <div className="icon-pick">
            {REGISTER_ICONS.map((name) => (
              <button key={name} type="button" className={draft.icon === name ? 'on' : ''} onClick={() => set({ icon: name })}
                aria-label={name} aria-pressed={draft.icon === name}>
                <Icon name={name} size={20} />
              </button>
            ))}
          </div>
        </div>

        <div className="field-group" role="group" aria-label={t('builder.fillRoles')}>
          <span className="field-label">{t('builder.fillRoles')}</span>
          <RoleChecks value={draft.fillRoles} onChange={(fillRoles) => set({ fillRoles })} />
        </div>

        <label className="check">
          <input type="checkbox" checked={hasClose}
            onChange={(e) => set(e.target.checked ? { closeLabels: emptyLabels(), closeRoles: ['leader', 'admin'] } : { closeLabels: null })} />
          {t('builder.hasClose')}
        </label>
        {draft.closeLabels && (
          <div className="sub-form">
            <LabelInputs label={t('builder.closeNames')} value={draft.closeLabels} onChange={(closeLabels) => set({ closeLabels })} />
            <div className="field-group" role="group" aria-label={t('builder.closeRoles')}>
              <span className="field-label">{t('builder.closeRoles')}</span>
              <RoleChecks value={draft.closeRoles} onChange={(closeRoles) => set({ closeRoles })} />
            </div>
          </div>
        )}

        <h3>{t('builder.fields')}</h3>
        {initial && <p className="hint">{t('builder.locked')}</p>}
        <ol className="builder-fields">
          {draft.fields.map((f, i) => {
            const saved = savedKeys.has(f.key)
            return (
              <li key={f.key} className={f.active ? '' : 'off'}>
                <div className="builder-field-head">
                  <button type="button" className="link grow" onClick={() => setOpen(open === f.key ? null : f.key)} aria-expanded={open === f.key}>
                    {open === f.key ? '▾' : '▸'} <strong>{fieldTitle(f)}</strong>
                    <span className="muted"> · {t(`builder.types.${f.type}`)}{f.required ? ` · ${t('builder.required')}` : ''}{f.active ? '' : ` · ${t('builder.hidden')}`}</span>
                  </button>
                  <button type="button" className="icon-btn" onClick={() => moveField(i, -1)} disabled={i === 0} aria-label={t('builder.moveUp')} title={t('builder.moveUp')}>▲</button>
                  <button type="button" className="icon-btn" onClick={() => moveField(i, 1)} disabled={i === draft.fields.length - 1} aria-label={t('builder.moveDown')} title={t('builder.moveDown')}>▼</button>
                  {saved
                    ? <button type="button" onClick={() => setField(f.key, { active: !f.active })}>{t(f.active ? 'builder.hide' : 'builder.show')}</button>
                    : <button type="button" onClick={() => setDraft((d) => ({ ...d, fields: d.fields.filter((x) => x.key !== f.key) }))}>{t('builder.remove')}</button>}
                </div>
                {open === f.key && (
                  <div className="builder-field-body">
                    <LabelInputs label={t('builder.fieldName')} value={f.labels} onChange={(labels) => setField(f.key, { labels })} />
                    <div className="row2">
                      <label>{t('builder.type')}
                        <select value={f.type} disabled={saved} onChange={(e) => setField(f.key, { type: e.target.value as RegisterFieldType })}>
                          {REGISTER_FIELD_TYPES.map((ty) => <option key={ty} value={ty}>{t(`builder.types.${ty}`)}</option>)}
                        </select>
                      </label>
                      {hasClose && (
                        <label>{t('builder.step')}
                          <select value={f.step} onChange={(e) => setField(f.key, { step: e.target.value === 'close' ? 'close' : 'open' })}>
                            <option value="open">{t('builder.stepOpen')}</option>
                            <option value="close">{t('builder.stepClose')}</option>
                          </select>
                        </label>
                      )}
                    </div>
                    {f.type === 'select' && (
                      <label>{t('builder.options')}
                        <textarea rows={4} value={f.options.join('\n')} dir="auto"
                          onChange={(e) => setField(f.key, { options: e.target.value.split('\n') })}
                          onBlur={(e) => setField(f.key, { options: e.target.value.split('\n').map((o) => o.trim()).filter(Boolean) })} />
                      </label>
                    )}
                    <label className="check"><input type="checkbox" checked={f.required} onChange={(e) => setField(f.key, { required: e.target.checked })} /> {t('builder.required')}</label>
                    <label className="check">
                      <input type="checkbox" checked={f.sensitive || f.type === 'person'} disabled={saved || f.type === 'person'}
                        onChange={(e) => setField(f.key, { sensitive: e.target.checked })} /> {t('builder.sensitive')}
                    </label>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
        <button type="button" onClick={addField}>+ {t('builder.addField')}</button>

        <div className="actions sticky">
          <button type="button" onClick={() => onClose(false)}>{t('common.cancel')}</button>
          <button type="button" className="primary big" disabled={busy} onClick={submit}>{t('common.save')}</button>
        </div>
      </section>

      <section className="card builder-preview" aria-label={t('builder.preview')}>
        <h2>{t('builder.preview')}</h2>
        <div className="register-head">
          <span className="tile-icon"><Icon name={registerIcon(draft.icon)} size={26} /></span>
          <h3>{labelOf(draft.labels, lang) || '—'}</h3>
        </div>
        <FieldInputs fields={shownDef.map((f) => ({ ...f, step: hasClose ? f.step : 'open' }))} step="open" values={preview} onChange={setPreview} accounts={accounts} />
        {hasClose && shownDef.some((f) => f.step === 'close') && (
          <>
            <h3>{draft.closeLabels ? labelOf(draft.closeLabels, lang) || t('builder.previewClose') : ''}</h3>
            <FieldInputs fields={shownDef} step="close" values={preview} onChange={setPreview} accounts={accounts} />
          </>
        )}
      </section>
    </div>
  )
}
