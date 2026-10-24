import type { ScrollTrigger } from 'gsap/ScrollTrigger'
import { narrow } from './state'
import { currentY, scrollToY } from './scroll'

/**
 * Presentation mode: full screen, one stop per slide (the pinned story gets four), driven by the keyboard.
 * Next is Space, Enter, PageDown, Down or the arrow that points the way the page reads; Esc leaves.
 */
export function initPresent(story: ScrollTrigger | null): void {
  const html = document.documentElement
  const hud = document.getElementById('hud')!
  const dots = document.getElementById('hudDots')!
  const slides = Array.from(document.querySelectorAll<HTMLElement>('[data-slide]'))
  let on = false
  let stops: number[] = []
  let idleTimer = 0

  const compute = (): void => {
    stops = []
    for (const s of slides) {
      const top = s.getBoundingClientRect().top + scrollY
      if (s.id === 'story' && story) {
        for (let k = 0; k < 4; k++) stops.push(story.start + ((story.end - story.start) * k) / 3)
      } else stops.push(Math.max(0, top))
    }
    stops = Array.from(new Set(stops.map((v) => Math.round(v)))).sort((a, b) => a - b)
    dots.innerHTML = stops.map(() => '<li></li>').join('')
    mark()
  }

  const nearest = (): number => {
    let bi = 0
    let bd = Infinity
    const y = currentY()
    stops.forEach((v, i) => { const d = Math.abs(v - y); if (d < bd) { bd = d; bi = i } })
    return bi
  }
  const mark = (): void => {
    const i = nearest()
    Array.from(dots.children).forEach((d, k) => d.classList.toggle('on', k === i))
  }
  const go = (delta: number): void => {
    const i = Math.min(stops.length - 1, Math.max(0, nearest() + delta))
    scrollToY(stops[i])
  }

  const wake = (): void => {
    html.classList.remove('idle')
    clearTimeout(idleTimer)
    idleTimer = window.setTimeout(() => html.classList.add('idle'), 2400)
  }

  const enter = async (): Promise<void> => {
    if (on || narrow()) return
    on = true
    html.classList.add('pres')
    hud.hidden = false
    try { await html.requestFullscreen?.() } catch { /* the browser may refuse; the mode still works */ }
    setTimeout(() => { compute(); scrollToY(stops[0] ?? 0, true) }, 350)
    wake()
  }
  const leave = (): void => {
    if (!on) return
    on = false
    html.classList.remove('pres', 'idle')
    hud.hidden = true
    clearTimeout(idleTimer)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
  }

  document.getElementById('presentBtn')?.addEventListener('click', () => void enter())
  document.getElementById('presentBtn2')?.addEventListener('click', () => void enter())
  document.getElementById('hudExit')!.addEventListener('click', leave)
  document.getElementById('hudNext')!.addEventListener('click', () => go(1))
  document.getElementById('hudPrev')!.addEventListener('click', () => go(-1))
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && on) leave() })
  addEventListener('scroll', () => { if (on) mark() }, { passive: true })
  addEventListener('pointermove', () => { if (on) wake() }, { passive: true })
  addEventListener('resize', () => { if (on) compute() })

  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|IFRAME)$/.test(e.target.tagName)) return
    if (!on) {
      if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey) void enter()
      return
    }
    const rtl = html.dir === 'rtl'
    const nextKeys = [' ', 'Enter', 'PageDown', 'ArrowDown', rtl ? 'ArrowLeft' : 'ArrowRight']
    const prevKeys = ['PageUp', 'ArrowUp', 'Backspace', rtl ? 'ArrowRight' : 'ArrowLeft']
    if (nextKeys.includes(e.key)) { e.preventDefault(); go(1) } else if (prevKeys.includes(e.key)) { e.preventDefault(); go(-1) } else if (e.key === 'Escape') leave()
    else if (e.key === 'Home') { e.preventDefault(); scrollToY(0) }
    else if (e.key === 'End') { e.preventDefault(); scrollToY(stops[stops.length - 1]) }
  })
}
