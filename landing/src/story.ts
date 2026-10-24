import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { narrow, reduced } from './state'

gsap.registerPlugin(ScrollTrigger)

/** The pinned scene: the paper register fails, the digital one keeps the mistake and who fixed it. */
export function initStory(): ScrollTrigger | null {
  const stage = document.getElementById('storyStage')!
  if (reduced || narrow()) { document.documentElement.classList.add('story-static'); return null }

  const q = <T extends Element>(s: string): T[] => Array.from(stage.querySelectorAll<T>(s))
  const ledger = document.getElementById('ledger')!
  const register = document.getElementById('register')!
  const scribble = stage.querySelector<SVGPathElement>('.scribble path')!
  const rows = q<HTMLElement>('.ledger-rows li')
  const corr = stage.querySelector<HTMLElement>('.register-rows .corr')!
  const regRows = q<HTMLElement>('.register-rows li').filter((el) => el !== corr)
  const orig = stage.querySelector<HTMLElement>('.register-rows .orig')!
  const chips = q<HTMLElement>('.story-chips li')
  const hp = stage.querySelector<HTMLElement>('.h-paper')!
  const hd = stage.querySelector<HTMLElement>('.h-digital')!

  gsap.set(scribble, { strokeDasharray: 1, strokeDashoffset: 1 })
  gsap.set(stage.querySelector('.fixhand'), { autoAlpha: 0, y: -6 })
  gsap.set(register, { autoAlpha: 0, yPercent: 14, rotate: 1.2 })
  gsap.set(regRows, { autoAlpha: 0, y: 12 })
  gsap.set(corr, { autoAlpha: 0, x: 24 })
  gsap.set(chips, { autoAlpha: 0, y: 16 })
  gsap.set(hd, { autoAlpha: 0, y: 18 })
  gsap.set(rows, { autoAlpha: 0, y: 12 })

  const tl = gsap.timeline({
    defaults: { ease: 'power2.out' },
    scrollTrigger: { trigger: stage, start: 'top top', end: '+=320%', pin: true, scrub: 0.6, anticipatePin: 1, id: 'story' }
  })
  tl.to(rows, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.12 })
    // paper: the mistake is scratched out and the information is gone
    .to(scribble, { strokeDashoffset: 0, duration: 0.7, ease: 'none' }, '+=0.2')
    .to(stage.querySelector('.wrong'), { opacity: 0.35, duration: 0.3 }, '<0.4')
    .to(stage.querySelector('.fixhand'), { autoAlpha: 1, y: 0, duration: 0.3 }, '>')
    .to({}, { duration: 0.5 })
    // swap: the ledger leaves, the register arrives
    .to(ledger, { autoAlpha: 0, yPercent: -10, rotate: -3, scale: 0.96, duration: 0.9, ease: 'power2.inOut' }, 'swap')
    .to(hp, { autoAlpha: 0, y: -18, duration: 0.5 }, 'swap')
    .to(hd, { autoAlpha: 1, y: 0, duration: 0.6 }, 'swap+=0.4')
    .to(register, { autoAlpha: 1, yPercent: 0, rotate: 0, duration: 0.9, ease: 'power2.inOut' }, 'swap+=0.2')
    .to(regRows, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.1 }, 'swap+=0.7')
    // digital: the mistake stays, the correction sits under it
    .to({}, { duration: 0.4 })
    .to(orig, { backgroundColor: 'rgba(216,24,48,.12)', duration: 0.3 })
    .to(corr, { autoAlpha: 1, x: 0, duration: 0.6 }, '>')
    .to(chips, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.15 }, '>0.2')
    .to({}, { duration: 0.6 })

  return tl.scrollTrigger!
}
