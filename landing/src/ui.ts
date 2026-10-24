import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { DOORS, FACTS, lang, onLang, t } from './i18n'
import { reduced } from './state'

const ICONS: Record<string, string> = {
  shift: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c2.9.2 5 2.5 5 5.8"/>',
  custody: '<circle cx="8" cy="15.5" r="3.6"/><path d="M10.6 13 20 3.6M16.5 7.1l2.4 2.4M13.6 10l2 2"/>',
  incidents: '<path d="M12 3.5 21.5 19.5h-19z"/><path d="M12 10v4.5M12 17.4h.01"/>',
  lost_found: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
  letters: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6.5L20.5 7"/>',
  events: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  add: '<path d="M12 5v14M5 12h14"/>'
}

const TONES = ['#c9735f', '#dca24c', '#e6d3b0', '#8fb6c6', '#6aa57e', '#a893c2', 'transparent']

// ---- the doors: one per paper book --------------------------------------------------------------------------
export function initDoors(): void {
  const row = document.getElementById('doorsRow')!
  const panel = document.getElementById('doorPanel')!
  const name = document.getElementById('doorName')!
  const blurb = document.getElementById('doorBlurb')!
  const fields = document.getElementById('doorFields')!
  let current = 0

  DOORS.forEach((d, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'door' + (d.key === 'add' ? ' door-add' : '')
    b.setAttribute('role', 'tab')
    b.id = `door-${d.key}`
    b.setAttribute('aria-controls', 'doorPanel')
    b.style.setProperty('--i', String(i))
    b.style.setProperty('--tone', TONES[i])
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[d.key]}</svg><span></span>`
    b.addEventListener('click', () => select(i, true))
    b.addEventListener('keydown', (e) => {
      const rtl = document.documentElement.dir === 'rtl'
      const fwd = e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')
      const bwd = e.key === (rtl ? 'ArrowRight' : 'ArrowLeft')
      if (fwd || bwd) { e.preventDefault(); select((i + (fwd ? 1 : DOORS.length - 1)) % DOORS.length, true) }
    })
    row.appendChild(b)
  })

  function render(): void {
    const d = DOORS[current]
    row.querySelectorAll<HTMLButtonElement>('.door').forEach((b, i) => {
      b.setAttribute('aria-selected', String(i === current))
      b.tabIndex = i === current ? 0 : -1
      b.querySelector('span')!.textContent = DOORS[i].name[lang]
    })
    name.textContent = d.name[lang]
    blurb.textContent = d.blurb[lang]
    fields.innerHTML = ''
    d.fields[lang].forEach((f) => { const li = document.createElement('li'); li.textContent = f; fields.appendChild(li) })
    panel.setAttribute('aria-labelledby', `door-${d.key}`)
    panel.style.setProperty('--tone', TONES[current] === 'transparent' ? '#f3ead9' : TONES[current])
  }

  function select(i: number, focus: boolean): void {
    current = i
    render()
    if (focus) document.getElementById(`door-${DOORS[i].key}`)!.focus()
    if (!reduced) gsap.fromTo(panel.children, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'expo.out', overwrite: true })
  }

  onLang(render)
  render()
}

// ---- the facts beside the wall ------------------------------------------------------------------------------
export function initFacts(): void {
  const ul = document.getElementById('facts')!
  const render = (): void => {
    ul.innerHTML = ''
    for (const f of FACTS) {
      const li = document.createElement('li')
      const h = document.createElement('h3')
      const p = document.createElement('p')
      h.textContent = f.title[lang]
      p.textContent = f.text[lang]
      li.append(h, p)
      ul.appendChild(li)
    }
  }
  onLang(render)
  render()
}

// ---- the walled town: data stays inside ---------------------------------------------------------------------

function tower(x: number, y: number): string {
  // a square tower with the corner horns of the ksar walls
  return `<path d="M${x - 15} ${y + 24}V${y - 14}l6 -12 6 12h6l6 -12 6 12V${y + 24}z" class="w-tower"/>`
}

export function initWalls(): void {
  const svg = document.getElementById('wallsSvg') as unknown as SVGSVGElement
  const pts: [number, number][] = [[150, 120], [370, 120], [448, 196], [448, 284], [370, 362], [150, 362], [72, 284], [72, 196]]
  const wall = 'M' + pts.map((p) => p.join(' ')).join('L') + 'z'
  svg.innerHTML = `
    <path d="${wall}" class="w-fill"/>
    <path d="${wall}" class="w-wall" pathLength="1"/>
    ${pts.map(([x, y]) => tower(x, y)).join('')}
    <g class="w-pc">
      <rect x="196" y="190" width="128" height="84" rx="9" class="w-line"/>
      <path d="M260 274v26M222 300h76" class="w-line"/>
      <path d="M214 212h60M214 228h92M214 244h72" class="w-rows"/>
      <g class="w-lock"><rect x="288" y="250" width="26" height="20" rx="4"/><path d="M293 250v-7a8 8 0 0 1 16 0v7" fill="none"/></g>
    </g>
    <path d="M233 362v-44a27 27 0 0 1 54 0v44z" class="w-gate"/>
    <circle cx="260" cy="338" r="5.2" class="w-key"/><path d="M260 342v12" class="w-key-l"/>
    <g class="w-cloud">
      <path d="M352 62a18 18 0 0 1 34-6a22 22 0 0 1 42 8a16 16 0 0 1-4 32h-68a17 17 0 0 1-4-34z" class="w-line"/>
      <path d="M346 30 440 112" class="w-no"/>
    </g>
    <g class="w-packets">
      <circle r="5.5" class="w-pk" cx="392" cy="90" opacity="0"/><circle r="5.5" class="w-pk" cx="392" cy="90" opacity="0"/><circle r="5.5" class="w-pk" cx="392" cy="90" opacity="0"/>
    </g>
    <text x="396" y="26" class="w-label" id="lblNet" text-anchor="middle"></text>
    <text x="260" y="406" class="w-label" id="lblPc" text-anchor="middle"></text>`

  const labels = (): void => {
    svg.querySelector('#lblNet')!.textContent = t('walls.net')
    svg.querySelector('#lblPc')!.textContent = t('walls.pc')
  }
  onLang(labels)
  labels()

  const packets = Array.from(svg.querySelectorAll<SVGCircleElement>('.w-pk'))
  if (reduced) return
  const wallPath = svg.querySelector<SVGPathElement>('.w-wall')!
  const towers = svg.querySelectorAll('.w-tower')
  const pc = svg.querySelector('.w-pc')

  // the wall draws itself, the towers rise on it, then the PC appears inside
  const intro = gsap.timeline({ paused: true })
    .fromTo(wallPath, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' })
    .fromTo(towers, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.5, stagger: 0.06, ease: 'back.out(1.6)' }, 0.45)
    .fromTo(pc, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out' }, 1.1)
  intro.pause(0)

  // each packet leaves the cloud, hits the wall and is thrown back
  const loop = gsap.timeline({ repeat: -1, paused: true })
  packets.forEach((p, i) => {
    const t0 = i * 0.95
    loop.set(p, { attr: { cx: 392, cy: 90, opacity: 0 } }, t0)
      .to(p, { attr: { opacity: 1 }, duration: 0.2 }, t0)
      .to(p, { attr: { cx: 372 - i * 18, cy: 118 }, duration: 0.8, ease: 'power1.in' }, t0)
      .to(p, { attr: { cx: 410 + i * 14, cy: 70 - i * 6, opacity: 0 }, duration: 0.7, ease: 'power2.out' }, t0 + 0.8)
  })
  loop.to({}, { duration: 0.6 })

  // the intro plays once from anywhere past its start (a jump past the figure still finds it drawn);
  // the packets only run while the figure is on screen
  ScrollTrigger.create({ trigger: svg, start: 'top 80%', end: 'max', once: true, onEnter: () => intro.play() })
  ScrollTrigger.create({ trigger: svg, start: 'top bottom', end: 'bottom top', onToggle: (self) => (self.isActive ? loop.play() : loop.pause()) })
}
