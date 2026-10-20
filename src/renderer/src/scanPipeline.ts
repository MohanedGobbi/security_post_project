// Card scanning pipeline: turns one frame (camera or photo) into several enhanced versions and sends them to the
// reader (OCR in the main process) until one gives an identity document whose check digits all validate.
// A single shot of a single frame fails on glare, tilt and soft focus; a real reader keeps trying.
import type { ScanOptions, ScanResult } from '@shared/types'

/** [x, y, width, height] in source pixels */
export type Region = [number, number, number, number]

type Analyze = (image: Uint8Array, opts: ScanOptions) => Promise<ScanResult>

/** The QR of a visitor pass / badge (SECREG-…) is handled by the page, whatever the OCR finds */
const isAppCode = (r: ScanResult): boolean => r.barcodes.some((b) => b.text.startsWith('SECREG-'))

/** How good a read is: a valid document beats a partial one, a partial one beats nothing */
export function rank(r: ScanResult): number {
  if (isAppCode(r)) return 1000
  const filled = Object.values(r.fields).filter(Boolean).length
  return (r.valid ? 100 : 0) + (r.source !== 'none' ? 10 : 0) + filled
}

export const isDone = (r: ScanResult): boolean => r.valid || isAppCode(r)

// ---------- image operations on a canvas ----------
function canvasFor(src: CanvasImageSource, [sx, sy, sw, sh]: Region, targetWidth: number, rotateDeg = 0): HTMLCanvasElement {
  const scale = targetWidth / sw
  const c = document.createElement('canvas')
  c.width = Math.round(sw * scale)
  c.height = Math.round(sh * scale)
  const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  ctx.imageSmoothingQuality = 'high'
  if (rotateDeg) {
    // a slightly tilted card: rotate the picture about its centre, the corners are filled light
    ctx.fillStyle = '#e8e8e8'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.translate(c.width / 2, c.height / 2)
    ctx.rotate((rotateDeg * Math.PI) / 180)
    ctx.translate(-c.width / 2, -c.height / 2)
  }
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height)
  return c
}

/** Grayscale values 0..255 */
function grayOf(d: Uint8ClampedArray): Float32Array {
  const g = new Float32Array(d.length / 4)
  for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
  return g
}

function putGray(ctx: CanvasRenderingContext2D, g: ArrayLike<number>, w: number, h: number): void {
  const img = ctx.createImageData(w, h)
  for (let j = 0; j < w * h; j++) {
    const v = Math.min(255, Math.max(0, g[j]))
    img.data[j * 4] = img.data[j * 4 + 1] = img.data[j * 4 + 2] = v
    img.data[j * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

/** Contrast stretch between the 2nd and 98th percentile: helps with uneven desk lighting */
function stretch(g: Float32Array): Float32Array {
  const hist = new Uint32Array(256)
  for (const v of g) hist[v | 0]++
  const total = g.length
  let lo = 0, hi = 255, acc = 0
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.02) { lo = v; break } }
  acc = 0
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.02) { hi = v; break } }
  const range = Math.max(1, hi - lo)
  const out = new Float32Array(g.length)
  for (let i = 0; i < g.length; i++) out[i] = ((g[i] - lo) * 255) / range
  return out
}

/** Local threshold from a box-average (integral image): survives glare and shadows that a global threshold cannot */
function adaptive(g: Float32Array, w: number, h: number): Float32Array {
  const integral = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += g[y * w + x]
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row
    }
  }
  const r = Math.max(12, Math.round(w / 40))
  const out = new Float32Array(g.length)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1)
      const sum = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0]
      const mean = sum / ((x1 - x0) * (y1 - y0))
      out[y * w + x] = g[y * w + x] < mean * 0.9 ? 0 : 255
    }
  }
  return out
}

/** 3×3 sharpening: recovers some edge contrast of a soft-focus frame */
function sharpen(g: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(g.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = g[y * w + x]
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { out[y * w + x] = c; continue }
      out[y * w + x] = Math.min(255, Math.max(0, 5 * c - g[y * w + x - 1] - g[y * w + x + 1] - g[(y - 1) * w + x] - g[(y + 1) * w + x]))
    }
  }
  return out
}

type Treatment = 'plain' | 'adaptive' | 'sharp'

async function render(src: CanvasImageSource, region: Region, targetWidth: number, treatment: Treatment, rotateDeg = 0): Promise<Uint8Array> {
  const c = canvasFor(src, region, targetWidth, rotateDeg)
  const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  const { width: w, height: h } = c
  let g = stretch(grayOf(ctx.getImageData(0, 0, w, h).data))
  if (treatment === 'sharp') g = sharpen(g, w, h)
  else if (treatment === 'adaptive') g = adaptive(g, w, h)
  putGray(ctx, g, w, h)
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * A picture of the card as the guard sees it (color, not the black-and-white version used for reading),
 * small enough to keep with the entry: about 250 KB as JPEG.
 */
export async function snapshot(src: CanvasImageSource, region: Region, maxWidth = 1600): Promise<Uint8Array> {
  const width = Math.min(maxWidth, Math.round(region[2]))
  const c = canvasFor(src, region, width)
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.85))
  return new Uint8Array(await blob.arrayBuffer())
}

/** Variants of one frame, most promising first. The MRZ is in the bottom part of a card: that strip alone is faster and sharper to read. */
interface Variant { treatment: Treatment; strip: boolean; rotate: number }
const VARIANTS: Variant[] = [
  { treatment: 'plain', strip: true, rotate: 0 },
  { treatment: 'plain', strip: false, rotate: 0 },
  { treatment: 'adaptive', strip: true, rotate: 0 },
  { treatment: 'adaptive', strip: false, rotate: 0 },
  { treatment: 'sharp', strip: true, rotate: 0 },
  { treatment: 'plain', strip: true, rotate: 2.5 },
  { treatment: 'plain', strip: true, rotate: -2.5 },
  { treatment: 'adaptive', strip: false, rotate: 4 },
  { treatment: 'adaptive', strip: false, rotate: -4 }
]

const stripOf = ([x, y, w, h]: Region): Region => [x, y + h * 0.5, w, h * 0.5]

export interface ScanRun {
  /** how many variants of this frame to try (the live camera brings a new frame anyway) */
  variants: number
  /** the camera: the card fills the guide, so reading may stop early on empty frames */
  signal?: { cancelled: boolean }
  onProgress?(done: number, total: number): void
}

/**
 * Reads one frame: tries its variants until a document validates. Returns the best read (and whether it is valid).
 * The last variant also runs the multilingual text read so the guard gets lines to pick from when nothing validates.
 */
export async function scanFrame(src: CanvasImageSource, region: Region, analyze: Analyze, run: ScanRun): Promise<ScanResult> {
  let best: ScanResult | null = null
  const list = VARIANTS.slice(0, Math.max(1, run.variants))
  for (let i = 0; i < list.length; i++) {
    if (run.signal?.cancelled) break
    const v = list[i]
    const r = v.strip ? stripOf(region) : region
    const width = Math.min(2200, Math.max(1600, r[2]))
    const image = await render(src, r, width, v.treatment, v.rotate)
    const last = i === list.length - 1
    const res = await analyze(image, { barcodes: i === 0, text: last })
    run.onProgress?.(i + 1, list.length)
    if (!best || rank(res) > rank(best)) best = res
    if (isDone(res)) return res
  }
  return best ?? { source: 'none', fields: {}, valid: false, rawMrz: [], barcodes: [], lines: [] }
}

/**
 * Is there text-like detail in the bottom half of the card guide? A cheap look at a tiny copy of the frame,
 * so the camera loop does not run OCR on an empty desk or a blurred hand moving in.
 */
export function looksLikeCardText(src: CanvasImageSource, region: Region): boolean {
  const [x, y, w, h] = stripOf(region)
  const tw = 360
  const th = Math.max(20, Math.round((h / w) * tw))
  const c = document.createElement('canvas')
  c.width = tw
  c.height = th
  const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  ctx.drawImage(src, x, y, w, h, 0, 0, tw, th)
  const g = grayOf(ctx.getImageData(0, 0, tw, th).data)
  let strong = 0
  for (let j = 0; j < th; j++) {
    for (let i = 1; i < tw; i++) if (Math.abs(g[j * tw + i] - g[j * tw + i - 1]) > 28) strong++
  }
  const density = strong / (tw * th)
  // an empty desk has almost no strong edges; printed text has plenty
  return density > 0.012
}
