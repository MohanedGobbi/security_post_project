export const pointer = { x: 0, y: 0, active: false }

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
export const narrow = (): boolean => innerWidth < 820

window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return
  pointer.x = e.clientX
  pointer.y = e.clientY
  pointer.active = true
}, { passive: true })
document.documentElement.addEventListener('pointerleave', () => { pointer.active = false })
