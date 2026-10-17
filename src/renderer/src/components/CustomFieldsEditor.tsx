import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CustomEntity, CustomField, CustomFieldType } from '@shared/types'
import { fieldLabel } from '@shared/i18n'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import { errorText } from '../util'

const ENTITIES: CustomEntity[] = ['visit', 'vehicle', 'delivery']
const TYPES: CustomFieldType[] = ['text', 'number', 'yesno', 'select', 'date']
const EMPTY = { entity: 'visit' as CustomEntity, ar: '', en: '', fr: '', type: 'text' as CustomFieldType, options: '', required: false }

/** Administrator screen: extra questions per form, with labels in up to three languages. */
export default function CustomFieldsEditor(): ReactNode {
  const { t } = useTranslation()
  const { toast, features } = useApp()
  // forms of switched-off modules are not offered
  const entities = ENTITIES.filter((x) => x === 'visit' || (x === 'vehicle' ? features.modules.vehicles : features.modules.deliveries))
  const [fields, setFields] = useState<CustomField[]>([])
  const [f, setF] = useState(EMPTY)
  const lang = currentLang()

  const load = useCallback(() => {
    window.api.customFields.list(true).then(setFields)
  }, [])
  useEffect(load, [load])

  const run = async (fn: () => Promise<void>, ok?: string): Promise<void> => {
    try {
      await fn()
      if (ok) toast(ok)
      load()
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }

  const add = (e: FormEvent): void => {
    e.preventDefault()
    run(async () => {
      await window.api.customFields.add({
        entity: f.entity, labels: { ar: f.ar, en: f.en, fr: f.fr }, type: f.type,
        options: f.options.split('\n'), required: f.required
      })
      setF({ ...EMPTY, entity: f.entity })
    }, t('custom.saved'))
  }

  return (
    <section className="card users-card">
      <h2>{t('custom.title')}</h2>
      <p className="hint">{t('custom.intro')}</p>
      {fields.length === 0 ? <p className="empty">{t('custom.none')}</p> : (
        <div className="table-wrap">
          <table className="log-table static">
            <thead><tr><th>{t('custom.form')}</th><th>{t('custom.label')}</th><th>{t('custom.type')}</th><th>{t('custom.required')}</th><th /></tr></thead>
            <tbody>
              {fields.map((x) => (
                <tr key={x.id} className={x.active ? '' : 'disabled'}>
                  <td>{t(`custom.entity.${x.entity}`)}</td>
                  <td><strong>{fieldLabel(x, lang)}</strong><div className="muted">{[x.labels.ar, x.labels.fr, x.labels.en].filter(Boolean).join(' · ')}</div></td>
                  <td>{t(`custom.types.${x.type}`)}{x.type === 'select' && <div className="muted">{x.options.join(', ')}</div>}</td>
                  <td>
                    <label className="check">
                      <input type="checkbox" checked={x.required} onChange={(e) => run(() => window.api.customFields.update(x.id, { required: e.target.checked }))} />
                    </label>
                  </td>
                  <td className="row-actions">
                    <button type="button" onClick={() => run(() => window.api.customFields.update(x.id, { active: !x.active }))}>
                      {t(x.active ? 'custom.disable' : 'custom.enable')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form className="add-user" onSubmit={add}>
        <h3>{t('custom.add')}</h3>
        <div className="row3">
          <label>{t('custom.form')}
            <select value={f.entity} onChange={(e) => setF({ ...f, entity: e.target.value as CustomEntity })}>
              {entities.map((x) => <option key={x} value={x}>{t(`custom.entity.${x}`)}</option>)}
            </select>
          </label>
          <label>{t('custom.type')}
            <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as CustomFieldType })}>
              {TYPES.map((x) => <option key={x} value={x}>{t(`custom.types.${x}`)}</option>)}
            </select>
          </label>
          <label className="check bottom"><input type="checkbox" checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} /> {t('custom.required')}</label>
        </div>
        <p className="hint">{t('custom.labelHint')}</p>
        <div className="row3">
          <label lang="ar">{t('custom.label')} · العربية<input value={f.ar} onChange={(e) => setF({ ...f, ar: e.target.value })} dir="rtl" /></label>
          <label lang="fr">{t('custom.label')} · Français<input value={f.fr} onChange={(e) => setF({ ...f, fr: e.target.value })} dir="ltr" /></label>
          <label lang="en">{t('custom.label')} · English<input value={f.en} onChange={(e) => setF({ ...f, en: e.target.value })} dir="ltr" /></label>
        </div>
        {f.type === 'select' && (
          <label>{t('custom.options')}<textarea rows={3} value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} dir="auto" /></label>
        )}
        <div className="actions"><button className="primary" disabled={!f.ar.trim() && !f.fr.trim() && !f.en.trim()}>{t('custom.add')}</button></div>
      </form>
    </section>
  )
}
