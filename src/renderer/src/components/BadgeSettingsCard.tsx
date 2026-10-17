import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { BadgeSettings, BadgeSize } from '@shared/types'
import { useApp } from '../App'
import Icon from './Icon'
import { errorText } from '../util'

const SIZES: BadgeSize[] = ['cr80', 'label62', 'a6']

/** Administrator card: badge printer and layout, with a preview on a visitor currently inside. */
export default function BadgeSettingsCard(): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [s, setS] = useState<BadgeSettings | null>(null)
  const [printers, setPrinters] = useState<string[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const [sampleId, setSampleId] = useState<number | null>(null)

  useEffect(() => {
    window.api.badges.settings().then(setS)
    window.api.badges.printers().then(setPrinters).catch(() => setPrinters([]))
    window.api.visits.insideNow().then((rows) => setSampleId(rows[0]?.id ?? null))
  }, [])

  // live preview with the settings being edited
  useEffect(() => {
    if (!s || sampleId === null) return
    let stale = false
    window.api.badges.preview(sampleId, s)
      .then((png) => { if (!stale) setPreview(png) })
      .catch(() => undefined)
    return () => { stale = true }
  }, [s, sampleId])

  if (!s) return null
  const save = async (): Promise<void> => {
    try {
      await window.api.badges.setSettings(s)
      toast(t('settings.saved'))
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }

  return (
    <section className="card">
      <h2><Icon name="printer" /> {t('badge.title')}</h2>
      <label>{t('badge.printer')}
        <select value={s.printer} onChange={(e) => setS({ ...s, printer: e.target.value })}>
          <option value="">{t('badge.askPrinter')}</option>
          {printers.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <label>{t('badge.size')}
        <select value={s.size} onChange={(e) => setS({ ...s, size: e.target.value as BadgeSize })}>
          {SIZES.map((x) => <option key={x} value={x}>{t(`badge.sizes.${x}`)}</option>)}
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={s.autoPrint} onChange={(e) => setS({ ...s, autoPrint: e.target.checked })} /> {t('badge.autoPrint')}</label>
      <label className="check"><input type="checkbox" checked={s.showPhoto} onChange={(e) => setS({ ...s, showPhoto: e.target.checked })} /> {t('badge.showPhoto')}</label>
      <div className="badge-preview">
        {sampleId === null ? <p className="hint">{t('badge.previewHint')}</p> : preview && <img src={preview} alt={t('badge.preview')} />}
      </div>
      <div className="actions">
        {sampleId !== null && (
          <button type="button" onClick={() => window.api.badges.print(sampleId).catch((e) => toast(errorText(e, t), 'error'))}>
            <Icon name="printer" /> {t('badge.testPrint')}
          </button>
        )}
        <button type="button" className="primary" onClick={save}>{t('common.save')}</button>
      </div>
    </section>
  )
}
