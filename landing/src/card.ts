import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { CARD_RATIO, loadCardFonts, paintBack, paintFront, shadowTexture } from './cardart'
import { pointer, reduced } from './state'

export interface HeroScan { phase: 'idle' | 'flip' | 'scan' | 'done'; p: number }

export interface CardHandle {
  front: HTMLCanvasElement
  replay(): void
  onHero(fn: (s: HeroScan) => void): void
  onStep(fn: (i: number) => void): void
}

const DEPTH = 0.011
const H = 1 / CARD_RATIO
// the machine readable zone on the back, in card units (see cardart.ts: strip starts 420px down the 807px card)
const MRZ_TOP = H * (0.5 - 420 / 807)
const MRZ_H = H * (1 - 420 / 807)

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))
const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const smooth = (t: number): number => t * t * (3 - 2 * t)
const damp = (k: number, dt: number): number => 1 - Math.exp(-k * dt)

function roundedShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x + w, y + h - r)
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  s.lineTo(x + r, y + h)
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x, y + r)
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

function faceGeometry(shape: THREE.Shape): THREE.ShapeGeometry {
  const g = new THREE.ShapeGeometry(shape, 14)
  const pos = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) + 0.5, pos.getY(i) / H + 0.5)
  return g
}

/** Paints both faces and returns the front canvas (also used as the no-WebGL fallback). */
export async function paintCard(): Promise<{ front: HTMLCanvasElement; back: HTMLCanvasElement }> {
  await loadCardFonts()
  const front = document.createElement('canvas')
  const back = document.createElement('canvas')
  await Promise.all([paintFront(front, './brand/university.png'), paintBack(back)])
  return { front, back }
}

export function initCard(canvas: HTMLCanvasElement, art: { front: HTMLCanvasElement; back: HTMLCanvasElement }): CardHandle | null {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  // neutral tone mapping keeps the plaster colours of the print; the clearcoat carries the shine
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.95
  const camera = new THREE.PerspectiveCamera(28, 1, 10, 9000)
  // a warm key that follows the cursor puts a moving glint on the laminate
  const key = new THREE.DirectionalLight(0xfff1dc, 1.25)
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.35))

  const aniso = renderer.capabilities.getMaxAnisotropy()
  const tex = (c: HTMLCanvasElement): THREE.CanvasTexture => {
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = aniso
    return t
  }
  const mat = (map: THREE.Texture): THREE.MeshPhysicalMaterial => new THREE.MeshPhysicalMaterial({
    map, roughness: 0.6, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2, specularIntensity: 0.3
  })

  const shape = roundedShape(1, H, 0.045)
  const group = new THREE.Group()
  // the core, with rounded bevelled edges that catch the light when the card turns
  const BEV = 0.0032
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roundedShape(1 - BEV * 2, H - BEV * 2, 0.045 - BEV), {
      depth: DEPTH - BEV * 2, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 4, curveSegments: 18
    }).translate(0, 0, -(DEPTH - BEV * 2) / 2),
    new THREE.MeshPhysicalMaterial({ color: 0x0d3a22, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 })
  )
  const front = new THREE.Mesh(faceGeometry(shape), mat(tex(art.front)))
  front.position.z = DEPTH / 2 + 0.0004
  const back = new THREE.Mesh(faceGeometry(shape), mat(tex(art.back)))
  back.rotation.y = Math.PI
  back.position.z = -DEPTH / 2 - 0.0004
  group.add(body, front, back)

  // the hologram: an eight-point M'zab star over the corner of the photo, its colour shifting with the tilt
  const starShape = new THREE.Shape()
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 - Math.PI / 2
    const r = i % 2 === 0 ? 0.072 : 0.046
    if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  const tilt = { value: new THREE.Vector2() }
  const foil = new THREE.Mesh(new THREE.ShapeGeometry(starShape), new THREE.ShaderMaterial({
    uniforms: { uTilt: tilt },
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec2 uTilt; varying vec2 vP;
      vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main() {
        float r = length(vP);
        float rings = 0.5 + 0.5 * sin(r * 520.0 - atan(vP.y, vP.x) * 8.0);
        float h = vP.x * 5.0 + vP.y * 3.0 + uTilt.y * 1.9 - uTilt.x * 1.4;
        vec3 foil = mix(vec3(0.86, 0.84, 0.8), hue(fract(h)), 0.62);
        foil += 0.18 * rings;
        gl_FragColor = vec4(foil, 0.5 + 0.3 * rings);
      }`
  }))
  // photo spans x 64..394 and y 232..640 of the 1280 x 807 print; the star sits on its lower inner corner
  foil.position.set(394 / 1280 - 0.5, H * (0.5 - 600 / 807), DEPTH / 2 + 0.0009)
  group.add(foil)

  // a soft band of light that slides across the laminate as the card turns toward the cursor
  const shineMat = new THREE.ShaderMaterial({
    uniforms: { uTilt: tilt },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vU; void main() { vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec2 uTilt; varying vec2 vU;
      void main() {
        float d = vU.x * 0.9 + vU.y * 0.55 - (0.72 + uTilt.y * 1.3 - uTilt.x * 0.9);
        float band = exp(-d * d * 38.0) * 0.09 + exp(-d * d * 420.0) * 0.09;
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * band, 1.0);
      }`
  })
  const shineFront = new THREE.Mesh(front.geometry, shineMat)
  shineFront.position.z = DEPTH / 2 + 0.0012
  const shineBack = new THREE.Mesh(back.geometry, shineMat)
  shineBack.rotation.y = Math.PI
  shineBack.position.z = -DEPTH / 2 - 0.0016
  group.add(shineFront, shineBack)

  // the scan: a flat red read-head and the band it has already read, laid on the back face
  const scan = new THREE.Group()
  scan.rotation.y = Math.PI
  scan.position.z = -DEPTH / 2 - 0.0012
  const bandGeo = new THREE.PlaneGeometry(1, MRZ_H).translate(0.5, 0, 0)
  const band = new THREE.Mesh(bandGeo, new THREE.MeshBasicMaterial({ color: 0xd81830, transparent: true, opacity: 0.15, depthWrite: false }))
  band.position.set(-0.5, MRZ_TOP - MRZ_H / 2, 0)
  const head = new THREE.Mesh(
    new THREE.PlaneGeometry(0.0065, MRZ_H + 0.07),
    new THREE.MeshBasicMaterial({ color: 0xd81830, transparent: true, opacity: 0.96, depthWrite: false })
  )
  head.position.set(-0.5, MRZ_TOP - MRZ_H / 2, 0.0003)
  scan.add(band, head)
  scan.visible = false
  group.add(scan)
  scene.add(group)

  // a soft shadow under the floating card
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 0.95),
    new THREE.MeshBasicMaterial({ map: tex(shadowTexture()), transparent: true, depthWrite: false, opacity: 0.8 })
  )
  scene.add(shadow)

  const slots = Array.from(document.querySelectorAll<HTMLElement>('[data-card-slot]'))
  let vw = innerWidth
  let vh = innerHeight
  const resize = (): void => {
    vw = innerWidth
    vh = innerHeight
    renderer.setSize(vw, vh, false)
    camera.aspect = vw / vh
    camera.position.z = vh / 2 / Math.tan((camera.fov * Math.PI) / 360)
    camera.updateProjectionMatrix()
  }
  resize()
  addEventListener('resize', resize)

  let heroFn: (s: HeroScan) => void = () => undefined
  let stepFn: (i: number) => void = () => undefined
  let lastStep = -1

  // hero state machine: idle -> flip to the back -> scan -> flip to the front -> done
  const SEQ = { idle: 1.6, flipOut: 1.15, scan: 2.1, hold: 0.35, flipBack: 1.15, done: 6.5 }
  let seqT = reduced ? -1 : 0
  let heroFlip = 0
  let last: HeroScan = { phase: 'idle', p: 0 }
  const emitHero = (s: HeroScan): void => {
    if (s.phase !== last.phase || Math.abs(s.p - last.p) > 0.004) { last = s; heroFn(s) }
  }
  if (reduced) { heroFn({ phase: 'done', p: 1 }); last = { phase: 'done', p: 1 } }

  const stepHero = (dt: number): { flip: number; sweep: number } => {
    if (seqT < 0) return { flip: 0, sweep: -1 }
    seqT += dt
    const a = SEQ.idle
    const b = a + SEQ.flipOut
    const c = b + SEQ.scan
    const d = c + SEQ.hold
    const e = d + SEQ.flipBack
    const f = e + SEQ.done
    if (seqT < a) { heroFlip = 0; emitHero({ phase: 'idle', p: 0 }); return { flip: 0, sweep: -1 } }
    if (seqT < b) { heroFlip = Math.PI * ease((seqT - a) / SEQ.flipOut); emitHero({ phase: 'flip', p: 0 }); return { flip: heroFlip, sweep: -1 } }
    if (seqT < c) { const p = (seqT - b) / SEQ.scan; emitHero({ phase: 'scan', p }); return { flip: Math.PI, sweep: p } }
    if (seqT < d) { emitHero({ phase: 'scan', p: 1 }); return { flip: Math.PI, sweep: 1 } }
    if (seqT < e) { heroFlip = Math.PI + Math.PI * ease((seqT - d) / SEQ.flipBack); emitHero({ phase: 'done', p: 1 }); return { flip: heroFlip, sweep: 1 } }
    if (seqT < f) { emitHero({ phase: 'done', p: 1 }); return { flip: Math.PI * 2, sweep: -1 } }
    seqT = 0
    return { flip: 0, sweep: -1 }
  }

  // current pose (smoothed)
  const pos = new THREE.Vector3(0, 0, 0)
  let size = 0
  let tiltX = 0
  let tiltY = 0
  let scrubFlip = 0
  let activeId = ''
  let clock = 0
  let intro = 0

  const frame = (dt: number): void => {
    clock += dt
    // which slot is the card in right now
    let best: { el: HTMLElement; r: DOMRect } | null = null
    let bestD = Infinity
    for (const el of slots) {
      const r = el.getBoundingClientRect()
      if (r.width < 40 || r.bottom < vh * 0.04 || r.top > vh * 0.96) continue
      const d = Math.abs(r.top + r.height / 2 - vh / 2)
      if (d < bestD) { bestD = d; best = { el, r } }
    }
    const hero = stepHero(dt)
    let targetSize = 0.0001
    let tx = pos.x
    let ty = pos.y
    let flip = 0
    let sweep = -1
    if (best) {
      const { el, r } = best
      const id = el.dataset.cardSlot ?? ''
      const k = id === activeId ? 18 : 6
      if (id !== activeId) activeId = id
      targetSize = r.width
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      tx = cx - vw / 2
      ty = vh / 2 - cy
      pos.x += (tx - pos.x) * damp(k, dt)
      pos.y += (ty - pos.y) * damp(k, dt)
      if (el.dataset.pose === 'scrub') {
        // the card turns as the section crosses the screen, and reads its back at the middle
        const p = clamp((vh * 0.9 - cy) / (vh * 0.8), 0, 1)
        const want = Math.PI * smooth(clamp((p - 0.18) / 0.3, 0, 1))
        scrubFlip += (want - scrubFlip) * damp(7, dt)
        flip = scrubFlip
        const step = p < 0.34 ? 0 : p < 0.7 ? 1 : 2
        if (step !== lastStep) { lastStep = step; stepFn(step) }
        if (step >= 1 && !reduced) sweep = (clock % 2.6) / 2.6
      } else {
        flip = hero.flip
        sweep = hero.sweep
      }
    } else {
      // nowhere to be: shrink in place
      pos.x += (0 - pos.x) * damp(2, dt)
    }
    intro = Math.min(1, intro + dt / 1.4)
    // grow into a slot calmly, leave one quickly so no small card lingers between sections
    size += (targetSize * (0.7 + 0.3 * ease(intro)) - size) * damp(best ? 8 : 16, dt)

    // follow the cursor: face it, a little
    const cxPx = pos.x + vw / 2
    const cyPx = vh / 2 - pos.y
    let wantY: number
    let wantX: number
    if (pointer.active && !reduced) {
      wantY = clamp((pointer.x - cxPx) / (vw * 0.5), -1, 1) * 0.55
      wantX = clamp((pointer.y - cyPx) / (vh * 0.5), -1, 1) * 0.42
    } else {
      wantY = reduced ? 0.12 : Math.sin(clock * 0.6) * 0.22
      wantX = reduced ? -0.05 : Math.cos(clock * 0.5) * 0.1
    }
    tiltY += (wantY - tiltY) * damp(6, dt)
    tiltX += (wantX - tiltX) * damp(6, dt)
    const bob = reduced ? 0 : Math.sin(clock * 0.9) * 0.012

    group.position.set(pos.x, pos.y + bob * size, 0)
    group.scale.setScalar(Math.max(size, 0.0001))
    group.rotation.set(tiltX, flip + tiltY, Math.sin(clock * 0.4) * (reduced ? 0 : 0.02))
    tilt.value.set(tiltX, tiltY)
    group.visible = size > 24

    // scan overlay
    scan.visible = sweep >= 0
    if (sweep >= 0) {
      band.scale.x = Math.max(sweep, 0.0001)
      head.position.x = -0.5 + sweep
    }

    shadow.visible = group.visible
    shadow.position.set(pos.x + size * (0.04 + tiltY * 0.1), pos.y - size * (0.2 + tiltX * 0.08), -size * 0.35)
    shadow.scale.setScalar(Math.max(size, 0.0001))

    key.position.set((pointer.active ? pointer.x - vw / 2 : 200), (pointer.active ? vh / 2 - pointer.y : 300), 600)
    renderer.render(scene, camera)
  }

  let prev = performance.now()
  renderer.setAnimationLoop((now) => {
    if (document.hidden) { prev = now; return }
    const dt = Math.min(0.05, (now - prev) / 1000)
    prev = now
    frame(dt)
  })

  return {
    front: art.front,
    replay: () => { if (!reduced) seqT = 0 },
    onHero: (fn) => { heroFn = fn; if (reduced) fn({ phase: 'done', p: 1 }) },
    onStep: (fn) => { stepFn = fn }
  }
}
