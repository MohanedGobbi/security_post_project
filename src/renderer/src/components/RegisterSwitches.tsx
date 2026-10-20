import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { RegisterDef } from '@shared/types'
import { labelOf } from '@shared/registers'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import { Switch } from './FeaturesSettings'
import { errorText } from '../util'

/** Settings → Registers: switch each register on or off. A switched-off register keeps its entries. */
export default function RegisterSwitches(): ReactNode {
  const { t } = useTranslation()
  const { toast } = useApp()
  const [regs, setRegs] = useState<RegisterDef[]>([])
  const lang = currentLang()

  const load = useCallback(() => {
    window.api.registers.list().then(setRegs)
  }, [])
  useEffect(load, [load])

  const toggle = async (r: RegisterDef): Promise<void> => {
    try {
      await window.api.registers.save({ ...r, active: !r.active })
      toast(t('settings.saved'))
      load()
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }

  if (regs.length === 0) return null
  return (
    <section className="card">
      <h2>{t('registers.settingsTitle')}</h2>
      <p className="hint">{t('registers.settingsIntro')}</p>
      <div className="switch-list">
        {regs.map((r) => (
          <Switch key={r.id} on={r.active} onChange={() => toggle(r)} name={labelOf(r.labels, lang)}
            desc={r.fillRoles.map((role) => t(`settings.roles.${role}`)).join(' · ')} />
        ))}
      </div>
    </section>
  )
}
