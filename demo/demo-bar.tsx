import { useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { resetDemo } from './store'
import { F } from './flavors'

type Kind = 'app' | 'dashboard'

const TEXT = {
  en: { demo: 'Demo', pin: 'PIN', dashboard: 'demo@security-register.app · demo1234', local: 'data stays in this browser', reset: 'Reset demo', home: 'Demo home' },
  fr: { demo: 'Démo', pin: 'PIN', dashboard: 'demo@security-register.app · demo1234', local: 'données dans ce navigateur', reset: 'Réinitialiser', home: 'Accueil démo' },
  ar: { demo: 'نسخة تجريبية', pin: 'الرقم السري', dashboard: 'demo@security-register.app · demo1234', local: 'البيانات في هذا المتصفح فقط', reset: 'إعادة التعيين', home: 'صفحة العرض' }
}

function Bar({ kind }: { kind: Kind }): ReactNode {
  const [lang, setLang] = useState(document.documentElement.lang)
  const [open, setOpen] = useState(true)
  // follow the language chosen in the app
  useEffect(() => {
    const obs = new MutationObserver(() => setLang(document.documentElement.lang))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    return () => obs.disconnect()
  }, [])
  const t = TEXT[(lang as keyof typeof TEXT) in TEXT ? (lang as keyof typeof TEXT) : 'en']
  if (!open) return <button type="button" className="demo-bar-mini" onClick={() => setOpen(true)} aria-label={t.demo}>{t.demo}</button>
  return (
    <div className="demo-bar" role="note">
      <strong>{t.demo}</strong>
      <span className="mono">{kind === 'app' ? `${t.pin}: ${F.users.map((u) => `${u.name} ${u.pin}`).join(' · ')}` : t.dashboard}</span>
      <span className="muted">{t.local}</span>
      <button type="button" className="link" onClick={() => { resetDemo(); location.reload() }}>{t.reset}</button>
      <button type="button" className="link" onClick={() => setOpen(false)} aria-label="×">×</button>
    </div>
  )
}

export function mountDemoBar(kind: Kind): void {
  const el = document.createElement('div')
  document.body.appendChild(el)
  createRoot(el).render(<Bar kind={kind} />)
}
