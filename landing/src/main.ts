import '@fontsource/reem-kufi/arabic-500.css'
import '@fontsource/reem-kufi/arabic-600.css'
import '@fontsource/reem-kufi/arabic-700.css'
import '@fontsource/reem-kufi/latin-500.css'
import '@fontsource/reem-kufi/latin-600.css'
import '@fontsource/reem-kufi/latin-700.css'
import '@fontsource/readex-pro/arabic-300.css'
import '@fontsource/readex-pro/arabic-400.css'
import '@fontsource/readex-pro/arabic-600.css'
import '@fontsource/readex-pro/latin-300.css'
import '@fontsource/readex-pro/latin-400.css'
import '@fontsource/readex-pro/latin-600.css'
import '@fontsource/overpass-mono/latin-500.css'
import '@fontsource/aref-ruqaa/arabic-400.css'
import './style.css'

import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { applyI18n, initialLang, LANGS, onLang, setLang, t } from './i18n'
import { DAY, edgeURI, grainURI, ksarLayers, NIGHT } from './ksar'
import { initCard, paintCard } from './card'
import { PERSON } from './cardart'
import { initStory } from './story'
import { initDoors, initFacts, initWalls } from './ui'
import { initPresent } from './present'
import { initScroll } from './scroll'
import { narrow, pointer, reduced } from './state'

gsap.registerPlugin(ScrollTrigger)
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const html = document.documentElement

// ---- language ------------------------------------------------------------------------------------------------
document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) =>
  b.addEventListener('click', () => { const l = b.dataset.lang!; if ((LANGS as string[]).includes(l)) setLang(l as (typeof LANGS)[number]) })
)

// ---- plaster: the edges between sections, the grain, the ksar --------------------------------------------------
const EDGE: Record<string, string> = { rose: '#c9735f', blue: '#35607a', ochre: '#dca24c', lime: '#f3ead9', green: '#0f4426', night: '#1b2f45' }
document.querySelectorAll<HTMLElement>('[data-edge]').forEach((s) => {
  const c = EDGE[s.dataset.edge!]
  if (c) s.style.setProperty('--edge', edgeURI(c))
})
html.style.setProperty('--grain', grainURI())
$('ksarDay').innerHTML = ksarLayers(DAY).join('')
$('ksarNight').innerHTML = ksarLayers(NIGHT, 21, 470).join('')

const layers = Array.from(document.querySelectorAll<SVGElement>('#ksarDay svg'))
const nightLayers = Array.from(document.querySelectorAll<SVGElement>('#ksarNight svg'))
let px = 0
let sy = 0
const drift = (): void => {
  const nx = pointer.active ? (pointer.x / innerWidth - 0.5) * 2 : 0
  px += (nx - px) * 0.06
  sy += (scrollY - sy) * 0.12
  const rtl = html.dir === 'rtl' ? -1 : 1
  layers.forEach((el, i) => { el.style.transform = `translate3d(${(-px * (i + 1) * 7 * rtl).toFixed(2)}px, ${(-sy * (0.02 + i * 0.045)).toFixed(2)}px, 0)` })
  requestAnimationFrame(drift)
}
if (!reduced) drift()
nightLayers.forEach((el, i) => el.setAttribute('data-n', String(i)))

// ---- the card --------------------------------------------------------------------------------------------------
const fields = Array.from(document.querySelectorAll<HTMLElement>('[data-fill]'))
const values = [`${PERSON.surnameAr} · ${PERSON.surname}`, `${PERSON.givenAr} · ${PERSON.given}`, PERSON.birth, PERSON.docNo]
const readout = $('readout')
const status = $('readoutStatus')
type Phase = 'idle' | 'flip' | 'scan' | 'done'
let phase: Phase = 'idle'
const paint = (p: number): void => {
  fields.forEach((f, i) => {
    const part = Math.min(1, Math.max(0, (p - i * 0.2) / 0.2))
    f.textContent = values[i].slice(0, Math.ceil(values[i].length * part))
  })
}
const setStatus = (ph: Phase): void => {
  readout.dataset.state = ph
  status.textContent = ph === 'done' ? t('form.done') : ph === 'scan' ? t('form.read') : t('form.wait')
}
onLang(() => setStatus(phase))
setStatus('idle')

async function bootCard(): Promise<void> {
  const art = await paintCard()
  const handle = initCard($('gl') as HTMLCanvasElement, art)
  if (!handle) {
    // no WebGL: the same card as a flat picture, the form already filled
    document.querySelectorAll<HTMLElement>('[data-card-slot]').forEach((s) => {
      s.classList.add('flat')
      s.style.backgroundImage = `url(${art.front.toDataURL('image/png')})`
    })
    paint(1)
    phase = 'done'
    setStatus('done')
    return
  }
  handle.onHero((s) => {
    phase = s.phase === 'flip' ? 'idle' : s.phase
    if (s.phase === 'idle' || s.phase === 'flip') paint(0)
    else if (s.phase === 'scan') paint(s.p)
    else paint(1)
    setStatus(phase)
  })
  handle.onStep((i) => document.querySelectorAll('#steps li').forEach((li, k) => li.classList.toggle('is-on', k === i)))
  const again = (): void => handle.replay()
  $('scanAgain').addEventListener('click', again)
  $('heroSlot').addEventListener('click', again)
  $('heroSlot').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); again() } })
  if (reduced) { paint(1); setStatus('done') }
}

// ---- the demo ------------------------------------------------------------------------------------------------------
function initDemo(): void {
  const frame = $('demoFrame') as HTMLIFrameElement
  const screen = $('deviceScreen')
  const fit = (): void => { frame.style.transform = `scale(${screen.clientWidth / 1440})` }
  new ResizeObserver(fit).observe(screen)
  fit()
  const src = frame.dataset.src!
  const load = async (): Promise<void> => {
    try {
      const r = await fetch(src, { cache: 'no-store' })
      const text = await r.text()
      if (!r.ok || !text.includes('id="root"')) throw new Error('missing')
    } catch (e) {
      // a file:// page cannot fetch; only a real "not the demo" answer counts as missing
      if (location.protocol !== 'file:') { $('demoMissing').hidden = false; return }
    }
    frame.src = src
  }
  new IntersectionObserver((es, io) => {
    if (es.some((e) => e.isIntersecting)) { io.disconnect(); void load() }
  }, { rootMargin: '700px 0px' }).observe(screen)
}

// ---- motion --------------------------------------------------------------------------------------------------------
function initMotion(): void {
  const bar = $('bar')
  addEventListener('scroll', () => bar.classList.toggle('scrolled', scrollY > 40), { passive: true })
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.bar-nav a'))
  document.querySelectorAll<HTMLElement>('[data-slide]').forEach((s) => {
    ScrollTrigger.create({
      trigger: s, start: 'top 55%', end: 'bottom 55%',
      onToggle: (self) => { if (self.isActive) links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${s.id}`)) }
    })
  })
  if (reduced) return
  // one authored entrance outside the card and the story: the doors climb like terraces (they stay visible throughout)
  const doors = document.getElementById('doors')!
  doors.classList.add('climb')
  ScrollTrigger.create({ trigger: doors, start: 'top 75%', once: true, onEnter: () => doors.classList.add('in') })
}

// ---- boot ----------------------------------------------------------------------------------------------------------
initScroll()
setLang(initialLang(), false)
applyI18n()
initDoors()
initFacts()
initWalls()
initDemo()
const story = initStory()
initPresent(story)
initMotion()
void bootCard()
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).then(() => {
  html.classList.add('ready')
  ScrollTrigger.refresh()
})
if (narrow()) html.classList.add('narrow')
