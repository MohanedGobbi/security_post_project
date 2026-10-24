import '@fontsource/alexandria/arabic-600.css'
import '@fontsource/alexandria/arabic-800.css'
import '@fontsource/alexandria/latin-600.css'
import '@fontsource/alexandria/latin-800.css'
import '@fontsource/tajawal/arabic-400.css'
import '@fontsource/tajawal/arabic-500.css'
import '@fontsource/tajawal/arabic-700.css'
import '@fontsource/tajawal/latin-400.css'
import '@fontsource/tajawal/latin-500.css'
import '@fontsource/tajawal/latin-700.css'
import '@fontsource/martian-mono/latin-400.css'
import '@fontsource/martian-mono/latin-500.css'
import './style.css'

import { applyI18n, initialLang, lang, LANGS, onLang, setLang, TICKER } from './i18n'
import { DOORS, FACTS } from './data'
import { createScene, type SceneApi } from './scene'
import { initScroll } from './scroll'
import { initPresent } from './present'
import { reduced } from './state'

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const html = document.documentElement

document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) =>
  b.addEventListener('click', () => { const l = b.dataset.lang!; if ((LANGS as string[]).includes(l)) setLang(l as (typeof LANGS)[number]) })
)

// ---- the ticker: sample morning entries, running along the foot of the first screen ---------------------------
function renderTicker(): void {
  const ul = $('ticker')
  const items = TICKER[lang]
  // twice, so the loop is seamless
  ul.innerHTML = [...items, ...items].map((s) => {
    const [time, ...rest] = s.split(' · ')
    return `<li><time>${time}</time><span>${rest.join(' · ')}</span></li>`
  }).join('')
}

// ---- registers: chips in the panel, books on the shelf, one selection --------------------------------------------
let scene: SceneApi | null = null
let current = 0
function renderRegisters(): void {
  const chips = $('chips')
  chips.innerHTML = ''
  DOORS.forEach((d, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip'
    b.setAttribute('role', 'tab')
    b.id = `reg-${d.key}`
    b.setAttribute('aria-selected', String(i === current))
    b.tabIndex = i === current ? 0 : -1
    b.textContent = d.name[lang]
    b.addEventListener('click', () => select(i))
    b.addEventListener('keydown', (e) => {
      const rtl = html.dir === 'rtl'
      const fwd = e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')
      const bwd = e.key === (rtl ? 'ArrowRight' : 'ArrowLeft')
      if (fwd || bwd) { e.preventDefault(); select((i + (fwd ? 1 : DOORS.length - 1)) % DOORS.length); document.getElementById(`reg-${DOORS[current].key}`)?.focus() }
    })
    chips.appendChild(b)
  })
  const d = DOORS[current]
  $('regName').textContent = d.name[lang]
  $('regBlurb').textContent = d.blurb[lang]
  $('regFields').innerHTML = d.fields[lang].map((f) => `<li>${f}</li>`).join('')
  $('regDetail').setAttribute('aria-labelledby', `reg-${d.key}`)
}
function select(i: number): void {
  current = i
  scene?.selectBook(i)
  renderRegisters()
}

function renderFacts(): void {
  $('facts').innerHTML = FACTS.map((f) => `<li><h3>${f.title[lang]}</h3><p>${f.text[lang]}</p></li>`).join('')
}

// ---- scroll drives the camera ------------------------------------------------------------------------------------
const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-shot]'))
let nodded = false
function onScroll(): void {
  if (!scene) return
  const anchor = innerHeight * 0.5
  let shot = 0
  let barrier = 0
  for (const s of sections) {
    const r = s.getBoundingClientRect()
    if (r.top <= anchor && r.bottom > anchor) {
      const local = (anchor - r.top) / r.height
      const i = Number(s.dataset.shot)
      // hold the section's shot, then glide to the next one over the last third
      const glide = Math.max(0, Math.min(1, (local - 0.62) / 0.38))
      shot = i + (i < sections.length - 1 ? glide : 0)
      if (s.id === 'gate') barrier = local > 0.18 && local < 0.8 ? 1 : 0
      if (s.id === 'shift' && local > 0.15 && !nodded) { nodded = true; scene.nod() }
      if (s.id === 'watch' && local < 0.3) nodded = false
    }
  }
  scene.setShot(shot)
  scene.setBarrier(barrier)
}

// ---- demo ----------------------------------------------------------------------------------------------------------
function initDemo(): void {
  const frame = $('demoFrame') as HTMLIFrameElement
  const screen = $('deviceScreen')
  const fit = (): void => { frame.style.transform = `scale(${screen.clientWidth / 1440})` }
  new ResizeObserver(fit).observe(screen)
  fit()
  const src = frame.dataset.src!
  new IntersectionObserver(async (es, io) => {
    if (!es.some((e) => e.isIntersecting)) return
    io.disconnect()
    try {
      const r = await fetch(src, { cache: 'no-store' })
      if (!r.ok || !(await r.text()).includes('id="root"')) throw new Error('missing')
    } catch {
      if (location.protocol !== 'file:') { $('demoMissing').hidden = false; return }
    }
    frame.src = src
  }, { rootMargin: '700px 0px' }).observe(screen)
}

// ---- boot ------------------------------------------------------------------------------------------------------------
initScroll()
setLang(initialLang(), false)
applyI18n()
renderTicker()
renderRegisters()
renderFacts()
onLang(() => { renderTicker(); renderRegisters(); renderFacts() })
initDemo()
initPresent(null)

const bar = $('bar')
addEventListener('scroll', () => { bar.classList.toggle('scrolled', scrollY > 40); onScroll() }, { passive: true })
if (reduced) html.classList.add('still')

createScene($('gl') as HTMLCanvasElement, DOORS.map((d) => d.name.ar)).then((s) => {
  if (!s) { html.classList.add('no-gl'); return }
  scene = s
  s.onBook(() => undefined, (i) => select(i))
  s.selectBook(current)
  onScroll()
  html.classList.add('scene-ready')
})
