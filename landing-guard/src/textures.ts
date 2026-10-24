// Everything painted for the morning gate: ledger spines, the faculty plaque, the building's windows, barrier stripes, paving, plaster.
import * as THREE from 'three'

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

const canvas = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

const tex = (c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture => {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export async function loadSceneFonts(): Promise<void> {
  await Promise.all([
    document.fonts.load('800 64px Alexandria', 'كلية الحقوق سجل'),
    document.fonts.load('600 64px Alexandria', 'FACULTY'),
    document.fonts.load('500 32px "Martian Mono"', '0123456789')
  ]).catch(() => undefined)
}

/** A cloth-bound ledger spine: two gilt bands, the register number, its name running up the spine. */
export function spineTexture(name: string, color: string, n: number, plus = false): THREE.CanvasTexture {
  const [c, g] = canvas(160, 800)
  g.fillStyle = color
  g.fillRect(0, 0, 160, 800)
  // cloth grain
  const r = rng(n * 31 + 7)
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.06)'
    g.fillRect(r() * 160, r() * 800, 1 + r() * 2, 1)
  }
  const gilt = '#d9a94e'
  g.fillStyle = gilt
  for (const y of [54, 66, 734, 746]) g.fillRect(14, y, 132, y === 66 || y === 746 ? 3 : 6)
  g.fillStyle = 'rgba(0,0,0,.28)'
  g.fillRect(0, 0, 10, 800)
  g.fillRect(150, 0, 10, 800)
  g.fillStyle = gilt
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '500 30px "Martian Mono"'
  g.fillText(plus ? '+' : String(n).padStart(2, '0'), 80, 116)
  // name, reading upward like a shelved book
  g.save()
  g.translate(84, 420)
  g.rotate(-Math.PI / 2)
  g.direction = 'rtl'
  g.font = `800 ${name.length > 18 ? 34 : 44}px Alexandria`
  g.fillStyle = '#f2e6cc'
  g.fillText(name, 0, 0, 560)
  g.restore()
  return tex(c)
}

/** The lit plaque over the gate. */
export async function plaqueTexture(logo: string): Promise<THREE.CanvasTexture> {
  const [c, g] = canvas(2048, 300)
  g.fillStyle = '#13294b'
  g.fillRect(0, 0, 2048, 300)
  g.strokeStyle = '#e09a2b'
  g.lineWidth = 6
  g.strokeRect(18, 18, 2012, 264)
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = logo }).catch(() => null)
  if (img) {
    g.fillStyle = '#f2ede4'
    g.beginPath()
    g.arc(160, 150, 104, 0, Math.PI * 2)
    g.fill()
    const h = 160
    g.drawImage(img, 160 - (h * img.width) / img.height / 2, 150 - h / 2, (h * img.width) / img.height, h)
  }
  g.fillStyle = '#f6e7c7'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.direction = 'rtl'
  g.font = '800 96px Alexandria'
  g.fillText('كلية الحقوق والعلوم السياسية', 1110, 118)
  g.direction = 'ltr'
  g.font = '600 40px Alexandria'
  g.fillStyle = '#d9a94e'
  g.fillText('FACULTÉ DE DROIT ET DES SCIENCES POLITIQUES · UNIVERSITÉ DE GHARDAÏA', 1110, 222)
  return tex(c)
}

/** A facade of glazed windows catching the morning sky, some with their blinds down. */
export function windowsTexture(cols: number, rows: number, seed: number): THREE.CanvasTexture {
  const cw = 64
  const ch = 80
  const [c, g] = canvas(cols * cw, rows * ch)
  g.fillStyle = '#e6d6bb'
  g.fillRect(0, 0, c.width, c.height)
  const r = rng(seed)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * cw + 14
      const py = y * ch + 14
      const w = cw - 28
      const h = ch - 26
      const sky = g.createLinearGradient(px, py, px + w, py + h)
      sky.addColorStop(0, '#9fbfd0')
      sky.addColorStop(1, '#4e6b80')
      g.fillStyle = sky
      g.fillRect(px, py, w, h)
      if (r() < 0.35) { g.fillStyle = '#d8c8ad'; g.fillRect(px, py, w, h * (0.3 + r() * 0.6)) }
      g.fillStyle = 'rgba(255,255,255,.25)'
      g.fillRect(px + 3, py + 3, 4, h - 6)
      g.fillStyle = '#b9a789'
      g.fillRect(px - 4, py + h, w + 8, 6)
    }
  }
  return tex(c)
}

export function stripesTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 32)
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 === 0 ? '#c8202e' : '#f2ede4'
    g.fillRect(i * 64, 0, 64, 32)
  }
  const t = tex(c)
  t.wrapS = THREE.RepeatWrapping
  return t
}

export function groundTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512)
  g.fillStyle = '#cdbb9c'
  g.fillRect(0, 0, 512, 512)
  const r = rng(99)
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.04 + r() * 0.05})` : `rgba(90,70,40,${0.04 + r() * 0.07})`
    g.fillRect(r() * 512, r() * 512, 1 + r() * 2.5, 1 + r() * 2.5)
  }
  // stone slabs
  g.strokeStyle = 'rgba(110,90,60,.45)'
  g.lineWidth = 2
  for (let y = 0; y <= 512; y += 128) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke()
    const off = (y / 128) % 2 === 0 ? 0 : 64
    for (let x = off; x <= 512; x += 128) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 128); g.stroke() }
  }
  const t = tex(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

export function plasterTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256)
  g.fillStyle = '#ece0c9'
  g.fillRect(0, 0, 256, 256)
  const r = rng(5)
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(120,95,60,.08)'
    g.beginPath()
    g.arc(r() * 256, r() * 256, 0.5 + r() * 2.2, 0, Math.PI * 2)
    g.fill()
  }
  const t = tex(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** The navy plate over the booth window. */
export function boothSignTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 205)
  g.fillStyle = '#13294b'
  g.fillRect(0, 0, 1024, 205)
  g.fillStyle = '#e09a2b'
  g.fillRect(0, 186, 1024, 19)
  g.fillStyle = '#f7f3ec'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.direction = 'rtl'
  g.font = '800 104px Alexandria'
  g.fillText('الأمن', 300, 92)
  g.direction = 'ltr'
  g.font = '600 52px Alexandria'
  g.fillText('SÉCURITÉ · SECURITY', 720, 96)
  return tex(c)
}
