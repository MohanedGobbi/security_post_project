import '@fontsource/cairo/400.css'
import '@fontsource/cairo/600.css'
import '@fontsource/cairo/700.css'
import '@renderer/styles.css'
import './demo.css'
import { StrictMode, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import Icon, { type IconName } from '@renderer/components/Icon'
import BrandMark from '@renderer/components/BrandMark'
import { applyBrand, BRAND } from '@renderer/brand'
import type { Lang } from '@shared/types'
import { resetDemo } from './store'

const REPO = 'https://github.com/MohanedGobbi/security_post_project'

const T: Record<Lang, {
  title: string; tagline: string; app: string; appDesc: string; dash: string; dashDesc: string; open: string; login: string
  featuresTitle: string; features: [IconName, string, string][]; note: string; reset: string; code: string; madeFor: string
}> = {
  en: {
    title: 'Security Register', tagline: 'The digital logbook for security guard posts: companies, universities, hospitals, sites of every size.',
    app: 'Reception app', appDesc: 'What the guard uses at the desk: visitors in and out, card scanning, vehicles, parcels, incidents, patrols, keys, shift handover.',
    dash: 'Supervisor dashboard', dashDesc: 'What managers see in a browser: every site live, records search, invitations with QR passes, posts, watchlist, users.',
    open: 'Open the demo', login: 'Sign in with',
    featuresTitle: 'What it does',
    features: [
      ['scan', 'ID card scanning', 'Passports and ID cards read offline (MRZ, barcodes); Arabic / French text picked with one click.'],
      ['shield', 'Watchlist & alerts', 'Refused people and plates stopped at entry; long stays, keys not returned, patrols due.'],
      ['calendar', 'Pre-registration & badges', 'Hosts invite visitors, who show a QR pass; printed badge with QR checks them out.'],
      ['clock', 'Shifts & handover', 'Each guard reads the previous handover; daily activity report at the end of the shift.'],
      ['cloud', 'Multi-site, offline-first', 'Each post works without network; a self-hosted server syncs sites to the dashboard.'],
      ['gear', 'Fits small and large sites', 'Profiles and switches: a one-door office sees a simple app, a university gets everything.']
    ],
    note: 'This demo runs entirely in your browser with sample data (nothing is sent anywhere). The real product is a Windows desktop app with offline OCR and a self-hosted server.',
    reset: 'Reset the demo data', code: 'Source code', madeFor: 'Demo prepared for'
  },
  fr: {
    title: 'Registre de sécurité', tagline: 'La main courante numérique des postes de sécurité : entreprises, universités, hôpitaux, sites de toutes tailles.',
    app: 'Application d’accueil', appDesc: 'Ce que l’agent utilise au poste : entrées et sorties, scan de la pièce d’identité, véhicules, colis, incidents, rondes, clés, passation.',
    dash: 'Tableau de bord des responsables', dashDesc: 'Ce que voient les responsables dans un navigateur : tous les sites en direct, registres, invitations avec QR, postes, liste de surveillance.',
    open: 'Ouvrir la démo', login: 'Connexion',
    featuresTitle: 'Fonctionnalités',
    features: [
      ['scan', 'Scan de pièce d’identité', 'Passeports et cartes lus hors ligne (MRZ, codes-barres) ; texte arabe / français repris d’un clic.'],
      ['shield', 'Liste de surveillance et alertes', 'Personnes et véhicules refusés bloqués à l’entrée ; présences prolongées, clés non rendues, rondes en retard.'],
      ['calendar', 'Pré-enregistrement et badges', 'Les hôtes invitent leurs visiteurs, qui présentent un QR ; le badge imprimé permet la sortie en un scan.'],
      ['clock', 'Services et passation', 'Chaque agent lit les consignes du précédent ; rapport d’activité à la fin du service.'],
      ['cloud', 'Multi-sites, hors ligne d’abord', 'Chaque poste fonctionne sans réseau ; un serveur auto-hébergé synchronise les sites.'],
      ['gear', 'Pour petits et grands sites', 'Profils et interrupteurs : un petit bureau voit une app simple, une université a tout.']
    ],
    note: 'Cette démo fonctionne entièrement dans votre navigateur avec des données d’exemple (rien n’est envoyé). Le vrai produit est une application Windows avec OCR hors ligne et un serveur auto-hébergé.',
    reset: 'Réinitialiser les données de démo', code: 'Code source', madeFor: 'Démonstration préparée pour'
  },
  ar: {
    title: 'سجل الحراسة', tagline: 'السجل الرقمي لنقاط الحراسة: الشركات، الجامعات، المستشفيات، ومواقع بكل الأحجام.',
    app: 'تطبيق الاستقبال', appDesc: 'ما يستعمله الحارس في المكتب: دخول وخروج الزوار، مسح بطاقة الهوية، السيارات، الطرود، الحوادث، الجولات، المفاتيح، تسليم المناوبة.',
    dash: 'لوحة متابعة المسؤولين', dashDesc: 'ما يراه المسؤولون في المتصفح: كل المواقع مباشرة، السجلات، الدعوات بتصاريح QR، النقاط، قائمة المراقبة.',
    open: 'فتح العرض', login: 'الدخول',
    featuresTitle: 'الوظائف',
    features: [
      ['scan', 'مسح بطاقة الهوية', 'قراءة جوازات السفر وبطاقات الهوية دون إنترنت؛ النص العربي والفرنسي بنقرة واحدة.'],
      ['shield', 'قائمة المراقبة والتنبيهات', 'منع الأشخاص والسيارات المحظورة عند الدخول؛ البقاء الطويل، المفاتيح غير المرجعة، الجولات المتأخرة.'],
      ['calendar', 'التسجيل المسبق والشارات', 'المضيفون يدعون زوارهم الذين يقدمون رمز QR؛ والشارة المطبوعة تسجل الخروج بمسحة.'],
      ['clock', 'المناوبات والتسليم', 'كل حارس يقرأ تعليمات من سبقه؛ تقرير نشاط يومي في نهاية المناوبة.'],
      ['cloud', 'متعدد المواقع ويعمل دون شبكة', 'كل نقطة تعمل دون إنترنت؛ خادم ذاتي الاستضافة يزامن المواقع مع لوحة المتابعة.'],
      ['gear', 'للمواقع الصغيرة والكبيرة', 'نماذج ومفاتيح تفعيل: مكتب صغير يرى تطبيقًا بسيطًا، والجامعة تحصل على كل شيء.']
    ],
    note: 'يعمل هذا العرض بالكامل في متصفحك ببيانات تجريبية (لا يُرسل أي شيء). المنتج الحقيقي تطبيق ويندوز مع قراءة ضوئية دون إنترنت وخادم ذاتي الاستضافة.',
    reset: 'إعادة تعيين بيانات العرض', code: 'الشيفرة المصدرية', madeFor: 'عرض مُعدّ لـ'
  }
}

function initialLang(): Lang {
  try {
    const l = localStorage.getItem('lang') as Lang | null
    if (l && l in T) return l
  } catch {
    // storage unavailable
  }
  return 'fr'
}

function Landing(): ReactNode {
  const [lang, setLang] = useState<Lang>(initialLang)
  const t = T[lang]
  const org = BRAND.org?.[lang] ?? null
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    try {
      // the two demos open in the same language
      localStorage.setItem('lang', lang)
    } catch {
      // storage unavailable
    }
  }, [lang])

  return (
    <div className="landing">
      <header className="landing-top">
        <div className="brand"><BrandMark /><strong>{t.title}</strong></div>
        <div className="lang-switch" role="group" aria-label="Language">
          {(['ar', 'en', 'fr'] as Lang[]).map((l) => (
            <button key={l} type="button" lang={l} className={l === lang ? 'active' : ''} onClick={() => setLang(l)}>
              {l === 'ar' ? 'العربية' : l === 'en' ? 'English' : 'Français'}
            </button>
          ))}
        </div>
      </header>
      <main>
        <section className="hero">
          {org && BRAND.logo && (
            <div className="hero-org">
              <img src={BRAND.logo} alt="" />
              <span>{t.madeFor}</span>
              <strong>{org}</strong>
            </div>
          )}
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </section>
        <section className="demo-cards">
          <a className="card demo-card" href="/app/">
            <span className="tile-icon"><Icon name="enter" size={30} /></span>
            <h2>{t.app}</h2>
            <p className="muted">{t.appDesc}</p>
            <p className="creds">{t.login}: <b>Admin</b> · PIN <b className="mono">1234</b></p>
            <span className="button primary">{t.open} →</span>
          </a>
          <a className="card demo-card" href="/dashboard/">
            <span className="tile-icon"><Icon name="home" size={30} /></span>
            <h2>{t.dash}</h2>
            <p className="muted">{t.dashDesc}</p>
            <p className="creds">{t.login}: <b className="mono">demo@security-register.app</b> · <b className="mono">demo1234</b></p>
            <span className="button primary">{t.open} →</span>
          </a>
        </section>
        <section>
          <h2>{t.featuresTitle}</h2>
          <div className="feature-grid">
            {t.features.map(([icon, title, desc]) => (
              <div key={title} className="feature">
                <Icon name={icon} size={24} />
                <div><strong>{title}</strong><p className="muted">{desc}</p></div>
              </div>
            ))}
          </div>
        </section>
        <p className="banner info">{t.note}</p>
        <footer className="landing-foot">
          <a href={REPO} target="_blank" rel="noreferrer">{t.code}</a>
          <button type="button" className="link" onClick={() => { resetDemo(); location.reload() }}>{t.reset}</button>
        </footer>
      </main>
    </div>
  )
}

// an organisation build (PIN-only login) opens straight on its login page, as the client asked
if (BRAND.loginMode === 'pin') {
  location.replace('/app/')
} else {
  applyBrand()
  createRoot(document.getElementById('root') as HTMLElement).render(<StrictMode><Landing /></StrictMode>)
}
