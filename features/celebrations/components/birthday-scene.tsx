"use client"

import { useEffect, useEffectEvent, useRef } from "react"
import * as THREE from "three"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"

// Plain three.js (no React renderer): React Three Fiber's global JSX types turn every
// `icon: React.ElementType` prop in the app into `never`.

export interface SceneProps {
  photos: { src: string; caption: string }[]
  /** -1 loading, 0 title, 1 name, 2 photos, 3 message, 4 make-a-wish. */
  stage: number
  /** Which photo has the spotlight (the others dim and step back), or none. */
  focus: number | null
  /** The cake rises into the room for her wish. */
  cakeIn: boolean
  blown: boolean
  reduce: boolean
  /** CSS font-family for the polaroid captions; the overlay loads it before the show starts. */
  fontFamily: string
  onCake: () => void
}

const PASTELS = ["#F5C451", "#F28DB2", "#B9A2FF", "#FFB38A", "#8FE3CF", "#FF8FA3"]
const CARD_W = 1.2
const CARD_H = 1.95
const PHOTO_W = 1.1
const PHOTO_H = PHOTO_W * (4 / 3)
const FOV = 42

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3
const easeOutBack = (p: number) => {
  const c = 1.70158
  const q = p - 1
  return 1 + (c + 1) * q * q * q + c * q * q
}

// Seeded, so every replay looks the same.
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = seeded(1310)

const BALLOONS = Array.from({ length: 8 }, (_, i) => ({
  side: i % 2 ? 1 : -1,
  inset: rand() * 1.2,
  z: -2.5 + rand() * 3,
  delay: 0.6 + rand() * 5,
  speed: 0.7 + rand() * 0.5,
  sway: 0.2 + rand() * 0.3,
  phase: rand() * Math.PI * 2,
  color: PASTELS[i % PASTELS.length]!,
  size: 0.85 + rand() * 0.35,
}))

const TIERS = [
  { r: 1.05, h: 0.46, y: 0 },
  { r: 0.8, h: 0.4, y: 0.46 },
  { r: 0.56, h: 0.36, y: 0.86 },
]
const CAKE_TOP = 1.22
const CANDLES = Array.from({ length: 5 }, (_, i) => {
  const a = (i / 5) * Math.PI * 2 - Math.PI / 2
  return { x: Math.cos(a) * 0.3, z: Math.sin(a) * 0.3 }
})

/**
 * Where everything sits for this screen. Landscape: the photos stand in a wide arc around and
 * behind the cake, so the whole gallery is in view and nothing ever crosses the cake. Portrait:
 * two rows of three above it.
 */
function computeLayout(width: number, height: number, count: number) {
  const aspect = width / Math.max(height, 1)
  const portrait = aspect < 0.8
  const camZ = portrait ? 12.5 : 11
  const visibleH = 2 * camZ * Math.tan((FOV * Math.PI) / 360)
  const halfW = (visibleH * aspect) / 2
  const targets: { x: number; y: number; z: number }[] = []
  if (portrait) {
    const cols = 3
    for (let i = 0; i < count; i++) {
      targets.push({
        x: ((i % cols) - (cols - 1) / 2) * 0.95,
        y: 1.7 - Math.floor(i / cols) * 1.45,
        z: -0.8,
      })
    }
  } else {
    // Evenly spaced left to right; the middle ones stand further back and a little higher.
    const rx = Math.min(Math.max(halfW * 0.72, 3.6), 5.8)
    for (let i = 0; i < count; i++) {
      const u = (i / (count - 1)) * 2 - 1
      const depth = Math.cos((u * Math.PI) / 2)
      targets.push({ x: u * rx, y: 0.35 + depth * 0.35, z: -depth * 2.4 })
    }
  }
  return {
    camZ,
    halfW,
    targets,
    card: portrait ? 0.62 : 1.15,
    // The spotlight: close to the camera, just above the middle of the screen.
    focusPos: portrait ? { x: 0, y: 0.75, z: 3 } : { x: 0, y: 0.45, z: 3.4 },
    focusScale: portrait ? 0.95 : 1.05,
    sway: portrait ? 0.05 : 0.1,
    cake: portrait ? 0.5 : 0.85,
    cakeY: portrait ? -2.45 : -2.05,
  }
}
type Layout = ReturnType<typeof computeLayout>

function radialTexture(inner: string, outer: string): THREE.CanvasTexture {
  const size = 128
  const c = document.createElement("canvas")
  c.width = c.height = size
  const ctx = c.getContext("2d")!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function captionTexture(text: string, fontFamily: string): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 512
  c.height = 128
  const ctx = c.getContext("2d")!
  ctx.font = `88px ${fontFamily}`
  ctx.fillStyle = "#6b3a52"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text, 256, 66)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Random points in a box, as a Points cloud with soft round sprites. */
function pointCloud(count: number, box: [number, number, number], size: number, color: string) {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * box[0]
    positions[i * 3 + 1] = (Math.random() - 0.5) * box[1]
    positions[i * 3 + 2] = (Math.random() - 0.5) * box[2]
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    size,
    color,
    map: radialTexture("rgba(255,255,255,1)", "rgba(255,255,255,0)"),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  return new THREE.Points(geo, mat)
}

interface Handle {
  setStage(stage: number): void
  setFocus(i: number | null): void
  showCake(): void
  blow(): void
  dispose(): void
}

function createScene(
  canvas: HTMLCanvasElement,
  photos: SceneProps["photos"],
  opts: { reduce: boolean; fontFamily: string; onCake: () => void },
): Handle {
  const { reduce } = opts
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  // No tone mapping: her photos must keep their true colours.
  renderer.toneMapping = THREE.NoToneMapping
  const maxAniso = renderer.capabilities.getMaxAnisotropy()

  const scene = new THREE.Scene()
  scene.background = new THREE.Color("#150a23")
  scene.fog = new THREE.Fog("#150a23", 16, 34)
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 120)
  camera.position.set(0, 1.3, 16.5)

  scene.add(new THREE.AmbientLight("#c9b8ff", 0.55))
  const key = new THREE.DirectionalLight("#fff1dd", 1.6)
  key.position.set(5, 8, 6)
  scene.add(key)
  const pink = new THREE.PointLight("#ff7ad9", 22, 22, 2)
  pink.position.set(-6, 3, 4)
  scene.add(pink)
  const blue = new THREE.PointLight("#7dd3fc", 14, 22, 2)
  blue.position.set(6, -1, 3)
  scene.add(blue)

  // Night sky: far stars, and gold dust drifting up through the room.
  const stars = pointCloud(1600, [90, 60, 60], 0.22, "#ffffff")
  stars.position.z = -20
  scene.add(stars)
  const dust = reduce ? null : pointCloud(140, [16, 9, 8], 0.14, "#ffd98a")
  const dustPhase = Float32Array.from({ length: 140 }, () => Math.random() * Math.PI * 2)
  if (dust) scene.add(dust)

  // Polaroids around the cake, always facing her.
  const ring = new THREE.Group()
  scene.add(ring)
  const pivots: THREE.Group[] = []
  const cards: THREE.Group[] = []
  const photoMats: THREE.MeshBasicMaterial[] = []
  const captionMats: THREE.MeshBasicMaterial[] = []
  const frameGeo = new THREE.PlaneGeometry(CARD_W, CARD_H)
  const photoGeo = new THREE.PlaneGeometry(PHOTO_W, PHOTO_H)
  const captionGeo = new THREE.PlaneGeometry(1.1, 0.275)
  // Unlit: the coloured room lights would tint the white paper.
  const cardMats: THREE.MeshBasicMaterial[][] = []
  const loader = new THREE.TextureLoader()
  photos.forEach((p) => {
    const pivot = new THREE.Group()
    const card = new THREE.Group()
    card.scale.setScalar(0.0001)
    // Unlit: the coloured room lights would tint the white paper. Per card, so each can dim.
    const frameMat = new THREE.MeshBasicMaterial({
      color: "#f6efe4",
      side: THREE.DoubleSide,
      transparent: true,
    })
    card.add(new THREE.Mesh(frameGeo, frameMat))
    const photoMat = new THREE.MeshBasicMaterial({
      color: "#d9cfc2",
      toneMapped: false,
      transparent: true,
    })
    // Photo and caption sit a hair in front of the paper; draw them after it, never occluding it.
    photoMat.depthWrite = false
    const photo = new THREE.Mesh(photoGeo, photoMat)
    photo.renderOrder = 1
    photo.position.set(0, CARD_H / 2 - 0.06 - PHOTO_H / 2, 0.006)
    card.add(photo)
    loader.load(p.src, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = maxAniso
      photoMat.map = tex
      photoMat.color.set("#ffffff")
      photoMat.needsUpdate = true
    })
    const captionMat = new THREE.MeshBasicMaterial({
      transparent: true,
      toneMapped: false,
      depthWrite: false,
      opacity: 0,
    })
    const caption = new THREE.Mesh(captionGeo, captionMat)
    caption.renderOrder = 2
    caption.position.set(0, -CARD_H / 2 + 0.21, 0.006)
    card.add(caption)
    pivot.add(card)
    ring.add(pivot)
    pivots.push(pivot)
    cards.push(card)
    photoMats.push(photoMat)
    captionMats.push(captionMat)
    cardMats.push([frameMat, photoMat, captionMat])
  })
  let captionsDrawn = false
  const drawCaptions = () => {
    if (captionsDrawn) return
    captionsDrawn = true
    captionMats.forEach((m, i) => {
      m.map = captionTexture(photos[i]!.caption, opts.fontFamily)
      m.needsUpdate = true
    })
  }

  // The cake.
  const cake = new THREE.Group()
  cake.visible = false
  scene.add(cake)
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(1.38, 1.38, 0.06, 48),
    new THREE.MeshStandardMaterial({ color: "#d9aa4f", metalness: 0.9, roughness: 0.3 }),
  )
  plate.position.y = -0.03
  cake.add(plate)
  TIERS.forEach((tier, i) => {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(tier.r, tier.r, tier.h, 48),
      new THREE.MeshStandardMaterial({ color: i % 2 ? "#f9c9d8" : "#fff2e2", roughness: 0.6 }),
    )
    body.position.y = tier.y + tier.h / 2
    cake.add(body)
    const frosting = new THREE.Mesh(
      new THREE.TorusGeometry(tier.r, 0.07, 12, 48),
      new THREE.MeshStandardMaterial({ color: "#f48fb1", roughness: 0.5 }),
    )
    frosting.rotation.x = Math.PI / 2
    frosting.position.y = tier.y + tier.h
    cake.add(frosting)
  })
  const flames: THREE.Group[] = []
  const smokes: THREE.Sprite[] = []
  const smokeTex = radialTexture("rgba(205,200,215,0.55)", "rgba(205,200,215,0)")
  const flameGeo = new THREE.SphereGeometry(0.05, 12, 12)
  // Colours above 1 so only the flames bloom, never the photos.
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.7, 0.5) })
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.3, 1.9) })
  CANDLES.forEach((c, i) => {
    const candle = new THREE.Group()
    candle.position.set(c.x, CAKE_TOP, c.z)
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.34, 12),
      new THREE.MeshStandardMaterial({ color: PASTELS[i], roughness: 0.5 }),
    )
    stick.position.y = 0.17
    candle.add(stick)
    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6),
      new THREE.MeshStandardMaterial({ color: "#333" }),
    )
    wick.position.y = 0.36
    candle.add(wick)
    const flame = new THREE.Group()
    flame.position.y = 0.43
    flame.add(new THREE.Mesh(flameGeo, flameMat))
    const core = new THREE.Mesh(flameGeo, coreMat)
    core.position.y = -0.01
    core.scale.set(0.5, 0.6, 0.5)
    flame.add(core)
    candle.add(flame)
    flames.push(flame)
    const smoke = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }),
    )
    smoke.visible = false
    candle.add(smoke)
    smokes.push(smoke)
    cake.add(candle)
  })
  const candleLight = new THREE.PointLight("#ffb366", 8, 7, 2)
  candleLight.position.y = CAKE_TOP + 0.9
  cake.add(candleLight)

  const balloons: THREE.Group[] = []
  if (!reduce) {
    const balloonGeo = new THREE.SphereGeometry(0.3, 32, 32)
    const knotGeo = new THREE.ConeGeometry(0.05, 0.08, 8)
    const stringGeo = new THREE.CylinderGeometry(0.004, 0.004, 1.1, 4)
    const stringMat = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.45,
    })
    for (const b of BALLOONS) {
      const g = new THREE.Group()
      g.scale.setScalar(b.size)
      g.visible = false
      const mat = new THREE.MeshPhysicalMaterial({
        color: b.color,
        roughness: 0.25,
        clearcoat: 1,
        clearcoatRoughness: 0.15,
      })
      const body = new THREE.Mesh(balloonGeo, mat)
      body.scale.set(1, 1.22, 1)
      g.add(body)
      const knot = new THREE.Mesh(knotGeo, mat)
      knot.position.y = -0.39
      knot.rotation.x = Math.PI
      g.add(knot)
      const string = new THREE.Mesh(stringGeo, stringMat)
      string.position.y = -0.95
      g.add(string)
      scene.add(g)
      balloons.push(g)
    }
  }

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.6, 1.0)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  let layout: Layout = computeLayout(1, 1, photos.length)
  const resize = () => {
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    layout = computeLayout(w, h, photos.length)
    pivots.forEach((p, i) => {
      const target = layout.targets[i]!
      p.position.set(target.x, target.y, target.z)
    })
    cake.scale.setScalar(layout.cake)
    cake.position.y = layout.cakeY
  }
  resize()
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)

  // Pointer: parallax for the camera, and clicks on the cake.
  const pointer = new THREE.Vector2()
  const raycaster = new THREE.Raycaster()
  const toNdc = (e: PointerEvent | MouseEvent) => {
    const r = canvas.getBoundingClientRect()
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  }
  const hitsCake = () => {
    raycaster.setFromCamera(pointer, camera)
    return cake.visible && raycaster.intersectObjects(cake.children, true).length > 0
  }
  let lastHover = 0
  const onMove = (e: PointerEvent) => {
    toNdc(e)
    const now = performance.now()
    if (now - lastHover > 80) {
      lastHover = now
      canvas.style.cursor = hitsCake() ? "pointer" : ""
    }
  }
  const onClick = (e: MouseEvent) => {
    toNdc(e)
    if (hitsCake()) opts.onCake()
  }
  window.addEventListener("pointermove", onMove)
  canvas.addEventListener("click", onClick)

  let stage = -1
  let focus: number | null = null
  let photosAt: number | null = null
  let cakeAt: number | null = null
  let blownAt: number | null = null
  let elapsed = 0
  const clock = new THREE.Clock()

  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.1)
    elapsed += dt
    const t = elapsed

    // Dolly in from far away while the title writes itself.
    const p = easeOutCubic(clamp01(t / 4))
    const tx = reduce ? 0 : pointer.x * 0.6
    const ty = 1.3 + (reduce ? 0 : pointer.y * 0.35)
    camera.position.set(
      THREE.MathUtils.damp(camera.position.x, tx, 2.5, dt),
      THREE.MathUtils.damp(camera.position.y, ty, 2.5, dt),
      layout.camZ + (reduce ? 0 : (1 - p) * 7),
    )
    camera.lookAt(0, -0.2, 0)

    stars.rotation.y += dt * 0.004
    if (dust) {
      const pos = dust.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + dt * 0.12
        if (y > 4.5) y -= 9
        pos.setY(i, y)
        pos.setX(i, pos.getX(i) + Math.sin(t * 0.5 + dustPhase[i]!) * 0.002)
      }
      pos.needsUpdate = true
    }

    // The gallery breathes: a slow sway, and each photo bobs on its own. The spotlit photo
    // glides to the front while the rest dim and step back.
    const since = photosAt === null ? -1 : t - photosAt
    ring.rotation.y = reduce ? 0 : Math.sin(t * 0.35) * layout.sway
    cards.forEach((c, i) => {
      const lit = focus === i
      const target = lit ? layout.focusPos : layout.targets[i]!
      const pivot = pivots[i]!
      pivot.position.set(
        THREE.MathUtils.damp(pivot.position.x, target.x, 5, dt),
        THREE.MathUtils.damp(pivot.position.y, target.y, 5, dt),
        THREE.MathUtils.damp(pivot.position.z, target.z, 5, dt),
      )
      const q = since < 0 ? 0 : clamp01((since - i * 0.22) / 1.1)
      const wanted = lit ? layout.focusScale : layout.card * (focus === null ? 1 : 0.8)
      const s = THREE.MathUtils.damp(c.scale.x / Math.max(easeOutBack(q), 0.0001), wanted, 5, dt)
      c.scale.setScalar(Math.max(easeOutBack(q) * s, 0.0001))
      const rise = (1 - easeOutCubic(q)) * -2
      c.position.y = rise + (reduce ? 0 : Math.sin(t * 1.1 + i * 1.3) * 0.08)
      c.lookAt(camera.position)
      const opacity = focus === null || lit ? 1 : 0.3
      for (const m of cardMats[i]!) m.opacity = THREE.MathUtils.damp(m.opacity, opacity, 4, dt)
    })

    // The cake rises into the room when it's time for her wish.
    if (cakeAt !== null) {
      const up = easeOutCubic(clamp01((t - cakeAt) / 1.6))
      cake.position.y = layout.cakeY - (1 - up) * 5
    }

    const out = blownAt === null ? 0 : clamp01((t - blownAt) / 0.35)
    flames.forEach((f, i) => {
      const flick = reduce ? 1 : 1 + Math.sin(t * 17 + i * 2.1) * 0.12 + Math.sin(t * 29 + i) * 0.08
      const s = Math.max(1 - out, 0.0001)
      f.scale.set(s, 1.5 * flick * s, s)
      f.position.x = reduce ? 0 : Math.sin(t * 23 + i) * 0.006
    })
    candleLight.intensity =
      (1 - out) * (8 + (reduce ? 0 : Math.sin(t * 13) * 1.5 + Math.sin(t * 31) * 0.8))
    smokes.forEach((s, i) => {
      const q = blownAt === null ? -1 : clamp01((t - blownAt - 0.15 - i * 0.05) / 2.6)
      s.visible = q > 0 && q < 1
      if (!s.visible) return
      s.position.set(Math.sin(q * 6 + i) * 0.08, 0.5 + q * 1.1, 0)
      const sc = 0.18 + q * 0.5
      s.scale.set(sc, sc, 1)
      s.material.opacity = (1 - q) * 0.55
    })

    balloons.forEach((g, i) => {
      const b = BALLOONS[i]!
      const tt = t - b.delay
      const y = -5 + tt * b.speed
      g.visible = tt >= 0 && y < 7
      if (!g.visible) return
      const sway = Math.sin(tt * 0.9 + b.phase)
      // Up the sides; a phone is narrow, so hug its edges.
      const edge = Math.max(layout.halfW - 0.7 - b.inset, layout.halfW * 0.7)
      g.position.set(b.side * edge + sway * b.sway, y, b.z)
      g.rotation.z = sway * 0.12
    })

    composer.render()
  }
  renderer.setAnimationLoop(frame)

  return {
    setStage(next) {
      stage = next
      if (stage >= 2 && photosAt === null) {
        drawCaptions()
        photosAt = elapsed
      }
    },
    setFocus(i) {
      focus = i
    },
    showCake() {
      if (cakeAt !== null) return
      cakeAt = elapsed
      cake.visible = true
    },
    blow() {
      if (blownAt === null) blownAt = elapsed
    },
    dispose() {
      renderer.setAnimationLoop(null)
      observer.disconnect()
      window.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("click", onClick)
      canvas.style.cursor = ""
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Sprite) {
          o.geometry.dispose()
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if ("map" in m && m.map instanceof THREE.Texture) m.map.dispose()
            m.dispose()
          }
        }
      })
      bloom.dispose()
      composer.dispose()
      renderer.dispose()
    },
  }
}

export default function BirthdayScene({
  photos,
  stage,
  focus,
  cakeIn,
  blown,
  reduce,
  fontFamily,
  onCake,
}: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handle = useRef<Handle | null>(null)
  const cake = useEffectEvent(onCake)

  useEffect(() => {
    const h = createScene(canvasRef.current!, photos, { reduce, fontFamily, onCake: () => cake() })
    handle.current = h
    return () => {
      h.dispose()
      handle.current = null
    }
  }, [photos, reduce, fontFamily])

  useEffect(() => {
    handle.current?.setStage(stage)
  }, [stage])

  useEffect(() => {
    handle.current?.setFocus(focus)
  }, [focus])

  useEffect(() => {
    if (cakeIn) handle.current?.showCake()
  }, [cakeIn])

  useEffect(() => {
    if (blown) handle.current?.blow()
  }, [blown])

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />
}
