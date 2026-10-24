import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { reduced } from './state'

gsap.registerPlugin(ScrollTrigger)

// Lenis smooths the wheel; GSAP's ticker drives it so ScrollTrigger, the pinned story and the card read the same frame.
let lenis: Lenis | null = null

export function initScroll(): void {
  if (reduced) return
  lenis = new Lenis({ autoRaf: false, lerp: 0.085, wheelMultiplier: 0.9, anchors: true, stopInertiaOnNavigate: true })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => lenis?.raf(time * 1000))
  // timelines follow real time, so a tab that comes back from the background does not replay in slow motion
  gsap.ticker.lagSmoothing(0)
}

export function scrollToY(y: number, immediate = false): void {
  if (lenis) lenis.scrollTo(y, { immediate, duration: 1.15, force: true, easing: (t) => 1 - Math.pow(1 - t, 4) })
  else window.scrollTo({ top: y, behavior: immediate ? ('instant' as ScrollBehavior) : 'smooth' })
}

export const currentY = (): number => lenis?.targetScroll ?? scrollY
