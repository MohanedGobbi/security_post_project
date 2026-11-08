import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { AttendanceRow, RegisterDef, VisitRow } from '@shared/types'
import { labelOf } from '@shared/registers'
import { useApp } from '../App'
import { currentLang } from '../i18n'
import Icon, { registerIcon } from '../components/Icon'
import { todayStr } from '../util'

/** What the dean sees first: who is inside now, the team on duty today, and the registers (with the visa waiting on incidents). */
export default function DeanHomePage(): ReactNode {
  const { t } = useTranslation()
  const { go, openRegister, user } = useApp()
  const lang = currentLang()
  const [inside, setInside] = useState<VisitRow[]>([])
  const [team, setTeam] = useState<AttendanceRow[]>([])
  const [regs, setRegs] = useState<RegisterDef[]>([])
  const [waiting, setWaiting] = useState(0)

  const load = useCallback(() => {
    window.api.visits.insideNow().then(setInside).catch(() => undefined)
    window.api.attendance.day(todayStr()).then(setTeam).catch(() => undefined)
    window.api.registers.list().then(async (rs) => {
      const active = rs.filter((r) => r.active)
      setRegs(active)
      const inc = active.find((r) => r.key === 'incidents')
      if (inc) {
        const open = await window.api.registers.entries({ registerId: inc.id, from: '', to: '', text: '', openOnly: true }).catch(() => [])
        setWaiting(open.length)
      }
    }).catch(() => undefined)
  }, [])
  useEffect(() => {
    load()
    const timer = setInterval(load, 60000)
    return () => clearInterval(timer)
  }, [load])

  const present = team.filter((r) => r.mark && (r.mark.status === 'present' || r.mark.status === 'late')).length
  return (
    <div className="stack">
      <section className="card">
        <h1>{t('dean.welcome', { name: user.name })}</h1>
        <div className="dean-stats">
          <div><b>{inside.length}</b><span>{t('dean.insideNow')}</span></div>
          <div><b>{team.length ? `${present}/${team.length}` : '—'}</b><span>{t('dean.teamPresent')}</span></div>
          <div className={waiting ? 'warn' : ''}><b>{waiting}</b><span>{t('dean.visaWaiting')}</span></div>
        </div>
        {waiting > 0 && <div className="banner warn">{t('dean.visaHelp', { n: waiting })}</div>}
      </section>
      <section className="card">
        <h2>{t('registers.title')}</h2>
        <section className="register-tiles">
          {regs.map((r) => (
            <button key={r.id} type="button" className="tile register-tile" onClick={() => { openRegister(r.id); go('registers') }}>
              <span className="tile-icon"><Icon name={registerIcon(r.icon)} size={30} /></span>
              <strong>{labelOf(r.labels, lang)}</strong>
            </button>
          ))}
        </section>
      </section>
    </div>
  )
}
