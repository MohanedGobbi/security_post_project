// The ksar of Ghardaia as layered paper-cut plaster: a hill of stacked cube houses climbing to a minaret.
// Generated from a seed so every render is the same; one SVG per layer so the layers can drift apart.

export interface Palette {
  layers: { fill: string; shade: string; hole: string }[]
  minaret: { body: string; shade: string; cap: string }
  palm: string
  lit: string | null // colour of lit windows (night), null by day
}

export const DAY: Palette = {
  layers: [
    { fill: '#b6cad2', shade: '#a4bac4', hole: '#8aa3b0' },
    { fill: '#c9b4b0', shade: '#b8a09d', hole: '#9c8280' },
    { fill: '#d9ac8c', shade: '#c4937a', hole: '#a67561' },
    { fill: '#c9735f', shade: '#ac5a49', hole: '#7e3f33' },
    { fill: '#8d4b3e', shade: '#703a30', hole: '#4d261f' }
  ],
  minaret: { body: '#f0e2c8', shade: '#d8c5a4', cap: '#c9735f' },
  palm: '#1a4a2c',
  lit: null
}

export const NIGHT: Palette = {
  layers: [
    { fill: '#3a5772', shade: '#33506a', hole: '#27405a' },
    { fill: '#304c67', shade: '#2a4560', hole: '#203750' },
    { fill: '#27405b', shade: '#213953', hole: '#1a2f46' },
    { fill: '#1e334b', shade: '#192c42', hole: '#13243a' },
    { fill: '#15263b', shade: '#11202f', hole: '#0c1827' }
  ],
  minaret: { body: '#4a6682', shade: '#3e586f', cap: '#27405b' },
  palm: '#0b1a2a',
  lit: '#f2b95c'
}

const W = 1600
const H = 640

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface LayerSpec { cx: number; reach: number; peak: number; wMin: number; wMax: number; step: number; windows: number }

// back to front; the third layer carries the minaret
const SPECS: LayerSpec[] = [
  { cx: 430, reach: 820, peak: 250, wMin: 56, wMax: 110, step: 26, windows: 0.5 },
  { cx: 1380, reach: 700, peak: 290, wMin: 46, wMax: 92, step: 24, windows: 0.7 },
  { cx: 770, reach: 520, peak: 385, wMin: 38, wMax: 76, step: 22, windows: 0.9 },
  { cx: 700, reach: 780, peak: 230, wMin: 34, wMax: 70, step: 20, windows: 0.9 },
  { cx: 800, reach: 1300, peak: 110, wMin: 40, wMax: 84, step: 16, windows: 0.8 }
]

function archPath(x: number, y: number, w: number, h: number): string {
  const r = w / 2
  return `M${x} ${y}v${-(h - r)}a${r} ${r} 0 0 1 ${w} 0v${h - r}z`
}

function minaret(x: number, base: number, p: Palette): string {
  const bw = 46
  const h = 130
  const tw = 28
  const top = base - h
  const m = p.minaret
  const slit = p.layers[2].hole
  let s = ''
  // tapered body, light side and shade side
  s += `<path d="M${x - bw / 2} ${base}L${x - tw / 2} ${top}H${x + tw / 2}L${x + bw / 2} ${base}z" fill="${m.body}"/>`
  s += `<path d="M${x + 2} ${base}L${x + 2} ${top}H${x + tw / 2}L${x + bw / 2} ${base}z" fill="${m.shade}"/>`
  // buttress horns at the corners of the gallery
  s += `<path d="M${x - tw / 2 - 9} ${top + 4}L${x - tw / 2 - 2} ${top - 18}L${x - tw / 2 + 4} ${top + 4}z" fill="${m.body}"/>`
  s += `<path d="M${x + tw / 2 + 9} ${top + 4}L${x + tw / 2 + 2} ${top - 18}L${x + tw / 2 - 4} ${top + 4}z" fill="${m.shade}"/>`
  s += `<rect x="${x - tw / 2 - 5}" y="${top - 4}" width="${tw + 10}" height="9" rx="2" fill="${m.cap}"/>`
  // lantern and pointed cap
  s += `<rect x="${x - 9}" y="${top - 30}" width="18" height="26" rx="2" fill="${m.body}"/>`
  s += `<path d="M${x - 12} ${top - 30}L${x} ${top - 62}L${x + 12} ${top - 30}z" fill="${m.cap}"/>`
  s += `<path d="M${x} ${top - 62}v-14" stroke="${m.cap}" stroke-width="3" stroke-linecap="round"/>`
  // slits and a small arched opening
  for (let i = 0; i < 4; i++) s += `<rect x="${x - 3}" y="${base - 30 - i * 28}" width="5" height="14" rx="2" fill="${slit}"/>`
  s += `<path d="${archPath(x - 6, top - 6, 12, 18)}" fill="${slit}" opacity=".85"/>`
  if (p.lit) s += `<path d="${archPath(x - 4, top - 8, 8, 12)}" fill="${p.lit}"/>`
  return s
}

function palm(x: number, base: number, scale: number, color: string): string {
  const th = 150 * scale
  const lean = (x > W / 2 ? -1 : 1) * 14 * scale
  let s = `<path d="M${x} ${base}Q${x + lean} ${base - th * 0.5} ${x + lean * 1.6} ${base - th}" stroke="${color}" stroke-width="${7 * scale}" fill="none" stroke-linecap="round"/>`
  const cx = x + lean * 1.6
  const cy = base - th
  for (let i = 0; i < 9; i++) {
    const a = (-168 + i * 19.5) * (Math.PI / 180)
    const len = (70 + (i % 2) * 14) * scale
    const ex = cx + Math.cos(a) * len
    const ey = cy + Math.sin(a) * len * 0.7 + len * 0.28
    const qx = cx + Math.cos(a) * len * 0.55
    const qy = cy + Math.sin(a) * len * 0.9 - 8 * scale
    s += `<path d="M${cx} ${cy}Q${qx} ${qy} ${ex} ${ey}" stroke="${color}" stroke-width="${4.2 * scale}" fill="none" stroke-linecap="round"/>`
  }
  return s
}

function layer(idx: number, p: Palette, seed: number, shift: number): string {
  const spec = { ...SPECS[idx] }
  if (idx === 2 || idx === 3) spec.cx += shift
  const col = p.layers[idx]
  const rand = rng(seed + idx * 977)
  let body = ''
  let holes = ''
  let lit = ''
  let x = -40
  let peakTop = H
  let peakX = spec.cx
  while (x < W + 40) {
    const w = spec.wMin + rand() * (spec.wMax - spec.wMin)
    const mid = x + w / 2
    const d = Math.abs(mid - spec.cx)
    const t = Math.max(0, 1 - d / spec.reach)
    let rise = spec.peak * Math.pow(t, 1.55)
    rise = Math.round((rise + rand() * 18) / spec.step) * spec.step
    const top = H - Math.max(rise, 26 + rand() * 20)
    if (top < peakTop) { peakTop = top; peakX = mid }
    const bodyTop = top
    body += `<rect x="${x.toFixed(1)}" y="${bodyTop}" width="${(w + 1.5).toFixed(1)}" height="${H - bodyTop + 4}" rx="5" fill="${col.fill}"/>`
    // shaded side wall gives the cube its volume
    const sw = Math.min(14, w * 0.24)
    body += `<rect x="${(x + w - sw).toFixed(1)}" y="${bodyTop + 4}" width="${sw.toFixed(1)}" height="${H - bodyTop}" fill="${col.shade}"/>`
    // parapet ledge
    body += `<rect x="${(x - 1).toFixed(1)}" y="${bodyTop - 4}" width="${(w + 3.5).toFixed(1)}" height="7" rx="3" fill="${col.fill}"/>`
    // arched openings
    if (rand() < spec.windows && H - bodyTop > 48) {
      const n = 1 + Math.floor(rand() * 2)
      for (let k = 0; k < n; k++) {
        const wx = x + 8 + rand() * Math.max(6, w - 30)
        const wy = bodyTop + 22 + rand() * Math.min(70, H - bodyTop - 40)
        const hh = 15 + rand() * 6
        holes += `<path d="${archPath(wx, wy + hh, 9, hh)}" fill="${col.hole}"/>`
        if (p.lit && rand() < 0.55) lit += `<path d="${archPath(wx + 1.5, wy + hh - 1, 6, hh - 4)}" fill="${p.lit}"/>`
      }
    }
    x += w - 2
  }
  let extra = ''
  if (idx === 2) extra += minaret(peakX, peakTop - 2, p)
  if (idx === 4) {
    extra += palm(150, H, 1.05, p.palm)
    extra += palm(240, H, 0.8, p.palm)
    extra += palm(1490, H, 1.0, p.palm)
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false" data-depth="${idx}">${body}${holes}${lit}${extra}</svg>`
}

/** `shift` moves the hill with the minaret sideways, so a centred text block can keep clear of it. */
export function ksarLayers(p: Palette, seed = 7, shift = 0): string[] {
  return p.layers.map((_, i) => layer(i, p, seed, shift))
}

// A stepped terrace silhouette, tiled across the top of a section so each wall sits on the one below.
export function edgeURI(color: string): string {
  const d =
    'M0 56V40h34v-10h38v10h20V20h46v20h30V30h30v10h40V12h54V40h30v-8h44v8h28V26h36v14h30V32h40v8h40V56z' +
    'M262 22v-8a9 9 0 0 1 18 0v8z'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="56" viewBox="0 0 480 56"><path fill="${color}" d="${d}"/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

// Fine plaster grain, laid over the whole page.
export function grainURI(): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .1  0 0 0 0 .1  0 0 0 0 .1  0 0 0 .55 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>'
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
