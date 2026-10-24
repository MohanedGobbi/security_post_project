// The specimen identity card: fictional person, real ICAO TD1 check-digit arithmetic, drawn on two canvases.
// It is a specimen on purpose: it carries no state emblem and says so on both faces.

export const CARD_W = 1280
export const CARD_H = 807
export const CARD_RATIO = CARD_W / CARD_H
// the print is drawn in 1280-wide units and rasterised at this scale, so text stays sharp on a large screen
const RES = 1.6

export interface Person {
  surnameAr: string; surname: string; givenAr: string; given: string
  birth: string; birthMrz: string; expiryMrz: string; docNo: string; sex: 'F' | 'M'
}

export const PERSON: Person = {
  surnameAr: 'بن سالم', surname: 'BENSALEM', givenAr: 'كريمة', given: 'KARIMA',
  birth: '12.03.1998', birthMrz: '980312', expiryMrz: '311105', docNo: 'SPEC12345', sex: 'F'
}

const W = [7, 3, 1]
function check(s: string): string {
  let sum = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    const v = c === '<' ? 0 : c >= '0' && c <= '9' ? c.charCodeAt(0) - 48 : c.charCodeAt(0) - 55
    sum += v * W[i % 3]
  }
  return String(sum % 10)
}

/** Three 30-character TD1 lines with valid check digits. */
export function mrzLines(p: Person = PERSON): [string, string, string] {
  const pad = (s: string, n: number): string => s.padEnd(n, '<')
  const dn = pad(p.docNo, 9)
  const l1a = `I<DZA${dn}${check(dn)}${pad('', 15)}`
  const l2a = `${p.birthMrz}${check(p.birthMrz)}${p.sex}${p.expiryMrz}${check(p.expiryMrz)}DZA${pad('', 11)}`
  const composite = check(l1a.slice(5, 30) + l2a.slice(0, 7) + l2a.slice(8, 15) + l2a.slice(18, 29))
  return [l1a, l2a + composite, pad(`${p.surname}<<${p.given}`, 30)]
}

const GREEN = '#0f4426'
const GREEN2 = '#16703a'
const LIME = '#f1e8d3'
const OCHRE = '#dca24c'
const ROSE = '#c9735f'
const RED = '#d81830'
const INK = '#10281f'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function loadCardFonts(): Promise<void> {
  const sample = 'بطاقة تعريف نموذج اللقب الاسم بن سالم كريمة'
  await Promise.all([
    document.fonts.load('600 40px "Reem Kufi"', sample),
    document.fonts.load('700 40px "Reem Kufi"', 'IDENTITY CARD SPECIMEN BENSALEM KARIMA'),
    document.fonts.load('400 24px "Readex Pro"', sample),
    document.fonts.load('600 24px "Readex Pro"', 'Nom Prénom Date of birth'),
    document.fonts.load('500 52px "Overpass Mono"', 'I<DZA0123456789')
  ]).catch(() => undefined)
}

function guilloche(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, alpha: number, phase = 0): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.globalAlpha = alpha
  ctx.lineWidth = 1.4
  for (let k = 0; k < 34; k++) {
    ctx.beginPath()
    for (let x = 0; x <= w; x += 8) {
      const y = h * 0.5 + Math.sin(x / 94 + k * 0.33 + phase) * (30 + k * 7) + Math.sin(x / 41 - k * 0.2) * 14 + (k - 17) * 11
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.restore()
}

// the interlaced eight-point star of the M'zab plasterwork, drawn as a small repeating frieze
function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath()
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.62
    const x = cx + Math.cos(a) * rr
    const y = cy + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function frieze(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, r: number, color: string): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  for (let x = x0 + r; x < x1; x += r * 2.2) {
    star(ctx, x, y, r)
    ctx.stroke()
  }
  ctx.restore()
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function stamp(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, sub: string): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.1)
  ctx.strokeStyle = RED
  ctx.fillStyle = RED
  ctx.globalAlpha = 0.92
  ctx.lineWidth = 5
  rrect(ctx, -150, -46, 300, 92, 10)
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.direction = 'rtl'
  ctx.font = '700 38px "Reem Kufi"'
  ctx.fillText(text, 0, -12)
  ctx.direction = 'ltr'
  ctx.font = '700 26px "Reem Kufi"'
  ctx.fillText(sub, 0, 22)
  ctx.restore()
}

export async function paintFront(canvas: HTMLCanvasElement, logoSrc: string): Promise<void> {
  const ctx = canvas.getContext('2d')!
  canvas.width = Math.round(CARD_W * RES)
  canvas.height = Math.round(CARD_H * RES)
  ctx.setTransform(RES, 0, 0, RES, 0, 0)
  const logo = await loadImage(logoSrc)
  // ground
  ctx.fillStyle = LIME
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  guilloche(ctx, CARD_W, CARD_H, GREEN2, 0.16)
  guilloche(ctx, CARD_W, CARD_H, OCHRE, 0.2, 2)
  // header band
  ctx.fillStyle = GREEN
  ctx.fillRect(0, 0, CARD_W, 168)
  ctx.fillStyle = OCHRE
  ctx.fillRect(0, 168, CARD_W, 8)
  frieze(ctx, 0, CARD_W, 168 - 20, 12, 'rgba(241,232,211,.28)')
  // university logo on a lime disc
  ctx.fillStyle = LIME
  ctx.beginPath()
  ctx.arc(116, 84, 62, 0, Math.PI * 2)
  ctx.fill()
  const lh = 92
  ctx.drawImage(logo, 116 - (lh * logo.width) / logo.height / 2, 84 - lh / 2, (lh * logo.width) / logo.height, lh)
  // title
  ctx.fillStyle = LIME
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'right'
  ctx.direction = 'rtl'
  ctx.font = '600 66px "Reem Kufi"'
  ctx.fillText('بطاقة تعريف', CARD_W - 64, 92)
  ctx.direction = 'ltr'
  ctx.textAlign = 'right'
  ctx.font = '500 26px "Readex Pro"'
  ctx.fillStyle = 'rgba(241,232,211,.82)'
  ctx.fillText('IDENTITY CARD  ·  CARTE D’IDENTITÉ', CARD_W - 64, 134)
  // photo: an abstract bust, no face
  rrect(ctx, 64, 232, 330, 408, 22)
  ctx.fillStyle = OCHRE
  ctx.fill()
  ctx.save()
  rrect(ctx, 64, 232, 330, 408, 22)
  ctx.clip()
  ctx.fillStyle = ROSE
  ctx.beginPath()
  ctx.ellipse(229, 640, 190, 150, 0, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = GREEN
  ctx.beginPath()
  ctx.arc(229, 408, 78, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = GREEN
  ctx.lineWidth = 5
  rrect(ctx, 64, 232, 330, 408, 22)
  ctx.stroke()
  // chip
  ctx.fillStyle = '#d9b457'
  rrect(ctx, 64, 668, 96, 70, 12)
  ctx.fill()
  ctx.strokeStyle = 'rgba(16,40,31,.45)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(64, 703); ctx.lineTo(160, 703)
  ctx.moveTo(112, 668); ctx.lineTo(112, 738)
  ctx.stroke()
  // fields, Arabic right-aligned with the Latin value under it
  const fx = CARD_W - 64
  const field = (y: number, labelAr: string, labelLat: string, ar: string, lat: string): void => {
    ctx.direction = 'rtl'
    ctx.textAlign = 'right'
    ctx.fillStyle = GREEN2
    ctx.font = '400 26px "Readex Pro"'
    ctx.fillText(labelAr, fx, y)
    ctx.direction = 'ltr'
    ctx.textAlign = 'left'
    ctx.font = '400 22px "Readex Pro"'
    ctx.fillText(labelLat, 450, y)
    ctx.fillStyle = INK
    ctx.direction = 'rtl'
    ctx.textAlign = 'right'
    ctx.font = '600 56px "Reem Kufi"'
    if (ar) ctx.fillText(ar, fx, y + 58)
    ctx.direction = 'ltr'
    ctx.textAlign = 'left'
    ctx.font = '700 46px "Reem Kufi"'
    ctx.fillText(lat, 450, y + 58)
  }
  field(236, 'اللقب', 'SURNAME', PERSON.surnameAr, PERSON.surname)
  field(374, 'الاسم', 'GIVEN NAME', PERSON.givenAr, PERSON.given)
  ctx.direction = 'ltr'
  ctx.textAlign = 'left'
  ctx.fillStyle = GREEN2
  ctx.font = '400 22px "Readex Pro"'
  ctx.fillText('DATE OF BIRTH', 450, 524)
  ctx.fillText('DOCUMENT No.', 800, 524)
  ctx.fillStyle = INK
  ctx.font = '500 44px "Overpass Mono"'
  ctx.fillText(PERSON.birth, 450, 580)
  ctx.fillText(PERSON.docNo, 800, 580)
  // specimen stamp
  stamp(ctx, 1020, 676, 'نموذج', 'SPECIMEN')
}

export async function paintBack(canvas: HTMLCanvasElement): Promise<void> {
  const ctx = canvas.getContext('2d')!
  canvas.width = Math.round(CARD_W * RES)
  canvas.height = Math.round(CARD_H * RES)
  ctx.setTransform(RES, 0, 0, RES, 0, 0)
  ctx.fillStyle = GREEN
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  guilloche(ctx, CARD_W, CARD_H, '#2f8a55', 0.34, 1)
  guilloche(ctx, CARD_W, CARD_H, OCHRE, 0.14, 3)
  frieze(ctx, 0, CARD_W, 70, 18, 'rgba(241,232,211,.22)')
  frieze(ctx, 0, CARD_W, 332, 18, 'rgba(241,232,211,.22)')
  // magnetic-style note and the specimen line
  ctx.fillStyle = LIME
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'center'
  ctx.direction = 'rtl'
  ctx.font = '600 44px "Reem Kufi"'
  ctx.fillText('نموذج للعرض فقط · بيانات وهمية', CARD_W / 2, 196)
  ctx.direction = 'ltr'
  ctx.font = '400 26px "Readex Pro"'
  ctx.fillStyle = 'rgba(241,232,211,.8)'
  ctx.fillText('SPECIMEN FOR DEMONSTRATION · FICTIONAL DATA · DONNÉES FICTIVES', CARD_W / 2, 248)
  // machine readable zone on a lime strip
  const y0 = 420
  ctx.fillStyle = LIME
  ctx.fillRect(0, y0, CARD_W, CARD_H - y0)
  ctx.fillStyle = INK
  ctx.font = '500 56px "Overpass Mono"'
  ctx.textAlign = 'left'
  ctx.direction = 'ltr'
  const lines = mrzLines()
  const step = 104
  const unit = (CARD_W - 128) / 30
  lines.forEach((ln, i) => {
    for (let k = 0; k < ln.length; k++) {
      ctx.textAlign = 'center'
      ctx.fillText(ln[k], 64 + unit * (k + 0.5), y0 + 120 + i * step)
    }
  })
}

export function shadowTexture(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 126)
  grd.addColorStop(0, 'rgba(16,34,40,.55)')
  grd.addColorStop(0.55, 'rgba(16,34,40,.22)')
  grd.addColorStop(1, 'rgba(16,34,40,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 256, 256)
  return c
}
