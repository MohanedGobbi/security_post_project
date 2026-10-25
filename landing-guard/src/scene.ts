// The morning gate in 3D: wall and arch with the faculty plaque, the guard booth with the register shelf,
// the barrier, palms, the faculty building, and the guard himself. Scroll picks the shot; the cursor is watched.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { groundTexture, loadSceneFonts, plaqueTexture, plasterTexture, spineTexture, stripesTexture, windowsTexture, boothSignTexture } from './textures'
import { pointer, reduced, narrow } from './state'

export interface SceneApi {
  /** 0 = gate, 1 = guard, 2 = shelf, 3 = barrier, 4 = overview, 5 = high, 6 = plaque; fractions blend */
  setShot(v: number): void
  /** 0 = down, 1 = up */
  setBarrier(v: number): void
  selectBook(i: number): void
  nod(): void
  onBook(hover: (i: number) => void, click: (i: number) => void): void
  /** true while the shelf shot is active, so the page knows clicks may go to books */
  shelfActive(): boolean
}

interface Shot { pos: THREE.Vector3; look: THREE.Vector3; fov: number }
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z)
const SHOTS: Shot[] = [
  { pos: v(1.6, 2.1, 10.4), look: v(2.5, 1.45, -0.6), fov: 36 },
  { pos: v(3.0, 1.62, 3.9), look: v(1.75, 1.42, 1.0), fov: 30 },
  { pos: v(3.15, 1.6, 0.55), look: v(3.4, 1.52, -1.8), fov: 36 },
  { pos: v(-0.6, 2.3, 7.2), look: v(-1.6, 1.3, -1.2), fov: 44 },
  { pos: v(8.5, 8.5, 13.5), look: v(0, 0.6, -2), fov: 38 },
  { pos: v(-2, 13, 20), look: v(0, 0, -3), fov: 36 },
  { pos: v(-1.0, 3.0, 13), look: v(-1.6, 3.6, -3.2), fov: 32 }
]

const BOOTH = { x: 3.4, z: -1.0, w: 2.4, d: 2.0, h: 2.7 }
const SPINES = ['#6e2a26', '#1f4d3a', '#23395b', '#9a6a22', '#4c5663', '#2c5d63', '#d9cdb4']

const mat = (color: string | number, rough = 0.85, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra })

function box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, cast = true): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  mesh.position.set(x, y, z)
  mesh.castShadow = cast
  mesh.receiveShadow = true
  return mesh
}

/** the gate block: a wall pierced by an arch, as one extruded shape */
function archBlock(width: number, height: number, depth: number, openW: number, openRect: number): THREE.ExtrudeGeometry {
  const s = new THREE.Shape()
  s.moveTo(-width / 2, 0)
  s.lineTo(width / 2, 0)
  s.lineTo(width / 2, height)
  s.lineTo(-width / 2, height)
  s.closePath()
  const h = new THREE.Path()
  const r = openW / 2
  h.moveTo(-r, 0)
  h.lineTo(-r, openRect)
  h.absarc(0, openRect, r, Math.PI, 0, true)
  h.lineTo(r, 0)
  h.closePath()
  s.holes.push(h)
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 24 })
}

function palm(x: number, z: number, h: number, group: THREE.Group): void {
  const trunkMat = mat('#8a6d4a', 0.95)
  const leafMat = mat('#4f6b3a', 0.8, { side: THREE.DoubleSide })
  let y = 0
  const segs = 7
  for (let i = 0; i < segs; i++) {
    const sh = h / segs
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.13 - i * 0.008, 0.16 - i * 0.008, sh, 8), trunkMat)
    seg.position.set(x + Math.sin(i * 0.3) * 0.05, y + sh / 2, z)
    seg.castShadow = true
    group.add(seg)
    y += sh
  }
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 1.9, 1, 6), leafMat)
    const pos = leaf.geometry.attributes.position
    for (let k = 0; k < pos.count; k++) {
      const ly = pos.getY(k)
      pos.setZ(k, -Math.pow((ly + 0.95) / 1.9, 2) * 0.7)
      pos.setX(k, pos.getX(k) * (1 - Math.abs(ly) / 1.2))
    }
    leaf.geometry.computeVertexNormals()
    leaf.geometry.translate(0, 0.95, 0)
    leaf.position.set(x, y, z)
    leaf.rotation.set(-1.05 + (i % 2) * 0.25, a, 0, 'YXZ')
    leaf.castShadow = true
    group.add(leaf)
  }
}

export async function createScene(canvas: HTMLCanvasElement, bookNames: string[]): Promise<SceneApi | null> {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.02
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  await loadSceneFonts()

  const scene = new THREE.Scene()
  // morning sky: pale blue overhead, warm at the horizon
  const sky = document.createElement('canvas')
  sky.width = 4
  sky.height = 256
  const sg = sky.getContext('2d')!
  const grad = sg.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#9fc3da')
  grad.addColorStop(0.55, '#cfe0e6')
  grad.addColorStop(1, '#f6dcb8')
  sg.fillStyle = grad
  sg.fillRect(0, 0, 4, 256)
  const skyTex = new THREE.CanvasTexture(sky)
  skyTex.colorSpace = THREE.SRGBColorSpace
  scene.background = skyTex
  scene.fog = new THREE.Fog('#ead9bd', 26, 75)

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200)

  // light: a low sun from the east and the sky above
  scene.add(new THREE.HemisphereLight('#d7e7f0', '#c9a97a', 1.25))
  const sun = new THREE.DirectionalLight('#ffd9a0', 3.1)
  sun.position.set(-11, 6.5, 9)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const sc = sun.shadow.camera
  sc.left = -16; sc.right = 16; sc.top = 14; sc.bottom = -10; sc.near = 1; sc.far = 45
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03
  scene.add(sun, sun.target)

  const world = new THREE.Group()
  scene.add(world)

  // ground and the road through the arch
  const gt = groundTexture()
  gt.repeat.set(36, 36)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat('#ffffff', 0.95, { map: gt }))
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  world.add(ground)
  const road = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 30), mat('#b3a183', 0.95))
  road.rotation.x = -Math.PI / 2
  road.position.set(-1.6, 0.004, -2)
  road.receiveShadow = true
  world.add(road)

  // the faculty wall, whitewashed sand, with the gate block and its arch
  const pt = plasterTexture()
  pt.repeat.set(6, 2)
  const plaster = mat('#ffffff', 0.92, { map: pt })
  const plasterGate = mat('#ffffff', 0.9, { map: pt.clone() })
  world.add(box(12.2, 3.0, 0.5, plaster, -10.3, 1.5, -3.2))
  world.add(box(14.6, 3.0, 0.5, plaster, 8.1, 1.5, -3.2))
  const gate = new THREE.Mesh(archBlock(5.4, 5.0, 0.8, 3.0, 2.4), plasterGate)
  gate.position.set(-1.6, 0, -3.6)
  gate.castShadow = gate.receiveShadow = true
  world.add(gate)
  // cornice and the stepped crest of the gate
  world.add(box(5.8, 0.18, 1.0, mat('#d9c7a6', 0.9), -1.6, 5.05, -3.2))
  for (let i = 0; i < 9; i++) world.add(box(0.36, 0.3 + (i % 2) * 0.12, 0.5, mat('#e9dcc3', 0.9), -1.6 - 2.6 + i * 0.65, 5.27 + (i % 2) * 0.06, -3.2))
  // the plaque
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6 * (300 / 2048)), new THREE.MeshStandardMaterial({ map: await plaqueTexture('./brand/university.png'), roughness: 0.6 }))
  plaque.position.set(-1.6, 4.35, -2.79)
  world.add(plaque)

  // the faculty building beyond the gate
  const wt = windowsTexture(18, 4, 3)
  const facade = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.75 })
  const sand = mat('#e2cfae', 0.9)
  const block = (w: number, h: number, d: number, x: number, z: number): void => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sand, sand, sand, sand, facade, sand])
    m.position.set(x, h / 2, z)
    m.castShadow = m.receiveShadow = true
    world.add(m)
    world.add(box(w + 0.3, 0.3, d + 0.3, mat('#d4bf9b', 0.9), x, h + 0.15, z))
  }
  block(16, 9, 6, -2, -17)
  block(8, 6.5, 6, -14, -14)
  block(8, 6.5, 6, 11, -14)
  const pg = new THREE.Group()
  palm(-6.2, -2.4, 4.6, pg)
  palm(4.0, -4.6, 5.4, pg)
  palm(-9.5, -5.2, 5.0, pg)
  world.add(pg)

  // the guard booth: whitewashed, a navy band, an open counter window, the register shelf inside
  const white = mat('#f1ebe0', 0.85)
  const navy = mat('#13294b', 0.7)
  const B = BOOTH
  const front = B.z + B.d / 2
  const backZ = B.z - B.d / 2
  world.add(box(B.w, B.h, 0.12, white, B.x, B.h / 2, backZ + 0.06))
  world.add(box(0.12, B.h, B.d, white, B.x - B.w / 2 + 0.06, B.h / 2, B.z))
  world.add(box(0.12, B.h, B.d, white, B.x + B.w / 2 - 0.06, B.h / 2, B.z))
  world.add(box(B.w, 1.0, 0.12, white, B.x, 0.5, front - 0.06))
  world.add(box(B.w, 0.6, 0.12, white, B.x, 2.4, front - 0.06))
  world.add(box(0.3, 1.1, 0.12, white, B.x - B.w / 2 + 0.15, 1.55, front - 0.06))
  world.add(box(0.3, 1.1, 0.12, white, B.x + B.w / 2 - 0.15, 1.55, front - 0.06))
  world.add(box(B.w + 0.4, 0.18, B.d + 0.4, mat('#e3d8c6', 0.8), B.x, B.h + 0.09, B.z))
  world.add(box(B.w - 0.24, 0.02, B.d - 0.24, mat('#f4efe4', 0.9), B.x, B.h - 0.01, B.z, false))
  world.add(box(B.w + 0.02, 0.16, B.d + 0.02, navy, B.x, 2.18, B.z, false))
  world.add(box(B.w + 0.1, 0.06, 0.4, mat('#cdbfa6', 0.7), B.x, 1.02, front + 0.08))
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.3), new THREE.MeshStandardMaterial({ map: boothSignTexture(), roughness: 0.6 }))
  sign.position.set(B.x, 2.45, front + 0.005)
  world.add(sign)
  // inside: desk, shelf, books, a warm desk light
  world.add(box(1.9, 0.05, 0.55, mat('#7a5a3a', 0.7), B.x, 0.98, front - 0.42))
  world.add(box(1.9, 0.035, 0.3, mat('#6d5035', 0.7), B.x, 1.36, backZ + 0.27))
  world.add(box(1.9, 0.035, 0.3, mat('#6d5035', 0.7), B.x, 1.86, backZ + 0.27))
  const lamp = new THREE.PointLight('#ffd9a0', 6, 5, 1.4)
  lamp.position.set(B.x, 2.3, B.z - 0.1)
  world.add(lamp)

  const books: THREE.Mesh[] = []
  const pages = mat('#efe6d2', 0.9)
  bookNames.forEach((name, i) => {
    const plus = i === bookNames.length - 1
    const cloth = mat(SPINES[i % SPINES.length], 0.75)
    const spine = new THREE.MeshStandardMaterial({ map: spineTexture(name, SPINES[i % SPINES.length], i + 1, plus), roughness: 0.7 })
    const bk = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.36, 0.25), [cloth, cloth, pages, cloth, spine, cloth])
    bk.position.set(B.x - ((bookNames.length - 1) * 0.11) / 2 + i * 0.11, 1.377 + 0.18, backZ + 0.27)
    bk.castShadow = true
    bk.userData = { i, home: bk.position.clone() }
    books.push(bk)
    world.add(bk)
  })

  // the barrier, red and white
  const post = box(0.3, 1.0, 0.3, navy, 0.75, 0.5, 0.7)
  world.add(post)
  world.add(box(0.12, 0.8, 0.12, navy, -3.6, 0.4, 0.7))
  const armPivot = new THREE.Group()
  armPivot.position.set(0.75, 0.92, 0.7)
  const st = stripesTexture()
  st.repeat.set(4, 1)
  const arm = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.09, 0.09), mat('#ffffff', 0.5, { map: st }))
  arm.position.x = -2.15
  arm.castShadow = true
  armPivot.add(arm, box(0.4, 0.18, 0.18, mat('#2a2f36', 0.6), 0.25, 0, 0))
  world.add(armPivot)

  // the security camera on the booth roof, watching the cursor
  const camMount = new THREE.Group()
  camMount.position.set(B.x - B.w / 2 + 0.15, B.h + 0.2, front - 0.1)
  camMount.add(box(0.05, 0.3, 0.05, navy, 0, 0.0, 0))
  const camHead = new THREE.Group()
  camHead.position.y = 0.15
  const housing = box(0.16, 0.14, 0.36, mat('#eef0f2', 0.4), 0, 0, 0.12)
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 20), mat('#14181d', 0.2, { metalness: 0.4 }))
  lens.rotation.x = Math.PI / 2
  lens.position.set(0, 0, 0.32)
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: '#d81830' }))
  led.position.set(0.05, 0.045, 0.3)
  camHead.add(housing, lens, led, box(0.2, 0.02, 0.4, mat('#dfe2e6', 0.5), 0, 0.085, 0.12))
  camMount.add(camHead)
  world.add(camMount)

  // the guard
  const guard = new THREE.Group()
  guard.position.set(1.75, 0, 1.05)
  guard.rotation.y = -0.32
  world.add(guard)
  let mixer: THREE.AnimationMixer | null = null
  let idleAction: THREE.AnimationAction | null = null
  let waveAction: THREE.AnimationAction | null = null
  const bones: { spine?: THREE.Bone; neck?: THREE.Bone; head?: THREE.Bone } = {}
  // rest pose of the bones we turn; restored every frame so the look-at never accumulates
  const rest = new Map<THREE.Bone, THREE.Quaternion>()
  new GLTFLoader().load('./models/guard.glb', (gltf) => {
    const model = gltf.scene
    // the officer: Quaternius' SWAT character (CC0), recoloured to the navy of the faculty's security team
    model.traverse((o) => {
      const m = o as THREE.SkinnedMesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
        const name = (m.material as THREE.Material).name
        m.material =
          name === 'Swat' ? mat('#22395f', 0.7)
          : name === 'Swat_Black' ? mat('#0f1724', 0.55, { metalness: 0.15 })
          : name === 'Visor' ? mat('#0b1018', 0.12, { metalness: 0.6 })
          : mat('#8d5f3c', 0.7)
      }
      if ((o as THREE.Bone).isBone) {
        if (o.name === 'Chest') bones.spine = o as THREE.Bone
        if (o.name === 'Neck') bones.neck = o as THREE.Bone
        if (o.name === 'Head') bones.head = o as THREE.Bone
      }
    })
    // stand him at a guard's height, feet on the ground
    const size = new THREE.Box3().setFromObject(model)
    const k = 1.82 / Math.max(0.01, size.max.y - size.min.y)
    model.scale.multiplyScalar(k)
    model.position.y -= size.min.y * k
    guard.add(model)
    model.updateMatrixWorld(true)
    // the gold badge on the chest, sized in metres whatever the bone scale is
    const attach = (bone: THREE.Bone | undefined, obj: THREE.Object3D, x: number, y: number, z: number): void => {
      if (!bone) return
      const ws = new THREE.Vector3()
      bone.getWorldScale(ws)
      obj.scale.setScalar(1 / ws.x)
      obj.position.set(x / ws.x, y / ws.x, z / ws.x)
      bone.add(obj)
    }
    const shield = new THREE.Shape()
    shield.moveTo(0, 0.035); shield.lineTo(0.028, 0.025); shield.lineTo(0.024, -0.015); shield.lineTo(0, -0.04); shield.lineTo(-0.024, -0.015); shield.lineTo(-0.028, 0.025); shield.closePath()
    const badge = new THREE.Mesh(new THREE.ExtrudeGeometry(shield, { depth: 0.006, bevelEnabled: false }), mat('#e0a640', 0.35, { metalness: 0.8 }))
    attach(bones.spine, badge, 0.09, 0.06, 0.16)

    for (const b of [bones.spine, bones.neck, bones.head]) if (b) rest.set(b, b.quaternion.clone())
    mixer = new THREE.AnimationMixer(model)
    const clip = (n: string): THREE.AnimationClip | undefined => gltf.animations.find((c) => c.name.endsWith('|' + n))
    const idleClip = clip('Idle_Neutral') ?? clip('Idle')
    const waveClip = clip('Wave')
    if (idleClip) idleAction = mixer.clipAction(idleClip).play()
    if (waveClip) {
      waveAction = mixer.clipAction(waveClip)
      waveAction.setLoop(THREE.LoopOnce, 1)
      waveAction.clampWhenFinished = true
      mixer.addEventListener('finished', (e) => {
        if (e.action !== waveAction) return
        idleAction?.reset().fadeIn(0.45).play()
        waveAction?.fadeOut(0.45)
      })
    }
  })

  // ---- interaction ------------------------------------------------------------------------------------------
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const lookPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -4.5)
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const lookAt = v(0, 1.6, 4.5)
  const camAim = v(0, 0, 4)
  let hover = -1
  let selected = 0
  let hoverFn: (i: number) => void = () => undefined
  let clickFn: (i: number) => void = () => undefined

  // ---- camera rig ---------------------------------------------------------------------------------------------
  let shotTarget = 0
  const camPos = SHOTS[0].pos.clone()
  const camLook = SHOTS[0].look.clone()
  let fov = SHOTS[0].fov
  let barrier = 0
  let barrierNow = 0
  const ease = (t: number): number => t * t * (3 - 2 * t)
  const shotAt = (s: number): Shot => {
    const i = Math.max(0, Math.min(SHOTS.length - 1, Math.floor(s)))
    const j = Math.min(SHOTS.length - 1, i + 1)
    const f = ease(Math.max(0, Math.min(1, s - i)))
    return { pos: SHOTS[i].pos.clone().lerp(SHOTS[j].pos, f), look: SHOTS[i].look.clone().lerp(SHOTS[j].look, f), fov: SHOTS[i].fov + (SHOTS[j].fov - SHOTS[i].fov) * f }
  }

  let w = 0
  let h = 0
  const resize = (): void => {
    w = innerWidth
    h = innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  addEventListener('resize', resize)

  const yawBones = { y: 0, p: 0 }
  const tmpQ = new THREE.Quaternion()
  const tmpV = new THREE.Vector3()
  const parentQ = new THREE.Quaternion()
  const turn = (bone: THREE.Bone | undefined, axis: THREE.Vector3, angle: number): void => {
    if (!bone || !bone.parent) return
    bone.parent.getWorldQuaternion(parentQ)
    tmpV.copy(axis).applyQuaternion(parentQ.invert())
    tmpQ.setFromAxisAngle(tmpV, angle)
    bone.quaternion.premultiply(tmpQ)
    bone.updateMatrixWorld(true)
  }

  const clock = new THREE.Clock()
  let t = 0
  const UP = v(0, 1, 0)
  renderer.setAnimationLoop(() => {
    if (document.hidden) { clock.getDelta(); return }
    const dt = Math.min(0.05, clock.getDelta())
    t += dt
    const k = (rate: number): number => 1 - Math.exp(-rate * dt)

    // camera follows the scroll shot, with a breath of drift
    const s = shotAt(shotTarget)
    camPos.lerp(s.pos, k(4))
    camLook.lerp(s.look, k(4))
    fov += (s.fov - fov) * k(4)
    camera.position.copy(camPos)
    if (!reduced) camera.position.y += Math.sin(t * 0.35) * 0.03
    camera.fov = fov
    // keep the subject clear of the text panel: shift the frame toward the free side
    const off = narrow() ? 0 : w * 0.14 * (document.documentElement.dir === 'rtl' ? 1 : -1)
    camera.setViewOffset(w, h, off, 0, w, h)
    camera.lookAt(camLook)
    camera.updateProjectionMatrix()

    // where the cursor points in the world
    if (pointer.active) {
      // the projection already carries the view offset, so plain screen coordinates are right
      ndc.set((pointer.x / w) * 2 - 1, -(pointer.y / h) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      ray.ray.intersectPlane(lookPlane, tmpV) && lookAt.lerp(tmpV, k(6))
      ray.ray.intersectPlane(groundPlane, tmpV) && camAim.lerp(tmpV, k(5))
    } else {
      lookAt.lerp(v(Math.sin(t * 0.25) * 3.5, 1.5 + Math.sin(t * 0.4) * 0.3, 4.5), k(1.5))
      camAim.lerp(v(Math.sin(t * 0.2) * 5 - 1, 0, 3 + Math.cos(t * 0.17) * 2), k(1.5))
    }

    // books: hover only while the shelf is in view
    const shelf = Math.abs(shotTarget - 2) < 0.35
    let h2 = -1
    if (shelf && pointer.active) {
      const hit = ray.intersectObjects(books, false)[0]
      if (hit) h2 = (hit.object.userData as { i: number }).i
    }
    if (h2 !== hover) { hover = h2; document.body.classList.toggle('book-hover', hover >= 0); if (hover >= 0) hoverFn(hover) }
    books.forEach((bk) => {
      const d = bk.userData as { i: number; home: THREE.Vector3 }
      const out = d.i === selected ? 0.15 : d.i === hover ? 0.06 : 0
      bk.position.z += (d.home.z + out - bk.position.z) * k(10)
      bk.rotation.y += ((d.i === selected ? -0.18 : 0) - bk.rotation.y) * k(10)
    })

    // barrier
    barrierNow += (barrier - barrierNow) * k(5)
    armPivot.rotation.z = -barrierNow * 1.35

    // security camera turns to the cursor's spot on the ground
    camHead.lookAt(camAim.x, camAim.y, camAim.z)

    // the guard: idle, then the head (and a little of the chest) turns to what the cursor is doing
    if (mixer) {
      // the idle clip does not key every bone, so start each frame from the rest pose before adding the look
      rest.forEach((q, b) => b.quaternion.copy(q))
      mixer.update(dt)
      guard.updateMatrixWorld(true)
      if (bones.head) {
        const hp = bones.head.getWorldPosition(new THREE.Vector3())
        const d = lookAt.clone().sub(hp)
        const yawWorld = Math.atan2(d.x, d.z) - guard.rotation.y
        const pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z))
        yawBones.y += (THREE.MathUtils.clamp(yawWorld, -1.05, 1.05) - yawBones.y) * k(5)
        yawBones.p += (THREE.MathUtils.clamp(pitch, -0.35, 0.45) - yawBones.p) * k(5)
        turn(bones.spine, UP, yawBones.y * 0.22)
        turn(bones.neck, UP, yawBones.y * 0.33)
        turn(bones.head, UP, yawBones.y * 0.45)
        const right = v(1, 0, 0).applyAxisAngle(UP, guard.rotation.y + yawBones.y)
        turn(bones.neck, right, yawBones.p * 0.4)
        turn(bones.head, right, yawBones.p * 0.6)
      }
    }

    renderer.render(scene, camera)
  })

  if (import.meta.env.DEV) (window as unknown as { __guard: unknown }).__guard = { bones, lookAt, guard, clock: () => t, mixer: () => mixer }

  // clicks on the shelf pick a book
  addEventListener('click', (e) => {
    if (hover < 0) return
    if ((e.target as HTMLElement).closest('a, button, iframe, .panel')) return
    clickFn(hover)
  })

  return {
    setShot: (s) => { shotTarget = s },
    setBarrier: (b) => { barrier = b },
    selectBook: (i) => { selected = i },
    nod: () => {
      if (!waveAction || reduced) return
      waveAction.reset().setEffectiveWeight(1).fadeIn(0.35).play()
      idleAction?.fadeOut(0.35)
    },
    onBook: (hv, ck) => { hoverFn = hv; clickFn = ck },
    shelfActive: () => Math.abs(shotTarget - 2) < 0.35
  }
}
