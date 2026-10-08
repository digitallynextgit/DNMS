import { baseName, canvasToBlob } from "./files"
import type { DecodedImage } from "./images"

// IS-Net "general use" model (Apache-2.0; ONNX export from rembg, MIT) via transformers.js in a
// Web Worker. One fp16 file (88 MB) serves both WebGPU and the CPU; the 8-bit one leaves specks.

export type ModelDevice = "webgpu" | "wasm"
export type ModelDtype = "fp16"

export interface ModelSpec {
  id: string
  /** A pinned commit, so a change upstream can't break the tool. */
  revision: string
  files: Record<ModelDtype, { path: string; bytes: number }>
  /** Per-channel (R, G, B) normalisation the model was trained with. */
  mean: readonly [number, number, number]
  std: readonly [number, number, number]
}

export const MODEL: ModelSpec = {
  id: "Ko033/isnet-general-use-onnx",
  revision: "5349b617911fd60c619b52f32e2b593517b78df3",
  files: {
    fp16: { path: "onnx/model_fp16.onnx", bytes: 88_141_111 },
  },
  mean: [0.5, 0.5, 0.5],
  std: [1, 1, 1],
}

export interface ModelPlan {
  device: ModelDevice
  dtype: ModelDtype
}

export interface GpuSupport {
  webgpu: boolean
  f16: boolean
}

/** Best first, the next tried on failure. Same file for both, so a fallback downloads nothing. */
export function modelPlans(gpu: GpuSupport): ModelPlan[] {
  const plans: ModelPlan[] = []
  if (gpu.webgpu && gpu.f16) plans.push({ device: "webgpu", dtype: "fp16" })
  plans.push({ device: "wasm", dtype: "fp16" })
  return plans
}

export function planFile(plan: ModelPlan): { path: string; bytes: number } {
  return MODEL.files[plan.dtype]
}

export function modelFileUrl(plan: ModelPlan): string {
  return `https://huggingface.co/${MODEL.id}/resolve/${MODEL.revision}/${planFile(plan).path}`
}

/** The model looks at the photo as a square this many pixels a side. */
export const MODEL_SIDE = 1024

/** "115 MB" - decimal megabytes, the way download sizes are usually quoted. */
export function megabytes(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1_000_000))} MB`
}

export const MAX_BG_BYTES = 25 * 1024 * 1024
/** A canvas runs out of room somewhere past this (phones much sooner). */
export const MAX_OUTPUT_PIXELS = 40_000_000
export const MAX_PHONE_OUTPUT_PIXELS = 16_000_000

export function fitPixels(
  width: number,
  height: number,
  maxPixels: number,
): { width: number; height: number; scaled: boolean } {
  if (width * height <= maxPixels) return { width, height, scaled: false }
  const k = Math.sqrt(maxPixels / (width * height))
  return {
    width: Math.max(1, Math.floor(width * k)),
    height: Math.max(1, Math.floor(height * k)),
    scaled: true,
  }
}

export function cutoutFileName(name: string, ext: "png" | "jpg"): string {
  const base = baseName(name).trim() || "image"
  return `${base}-no-background.${ext}`
}

export type BackgroundKind = "transparent" | "white" | "colour" | "blur"

export interface BackgroundChoice {
  kind: BackgroundKind
  colour: string
}

/** Null for see-through or the blurred photo. A JPG can't be see-through, so forJpg makes it white. */
export function backgroundFill(bg: BackgroundChoice, forJpg = false): string | null {
  switch (bg.kind) {
    case "white":
      return "#ffffff"
    case "colour":
      return bg.colour
    case "blur":
      return null
    case "transparent":
      return forJpg ? "#ffffff" : null
  }
}

export type ModelProblem = "offline" | "network" | "storage" | "memory" | "gpu" | "other"

export function modelProblem(err: unknown, online = true): ModelProblem {
  const text = (err instanceof Error ? `${err.name} ${err.message}` : String(err)).toLowerCase()
  if (/webgpu|shader|adapter|device (lost|removed)|storage buffer|graphics/.test(text)) return "gpu"
  if (/quota|no space|out of space/.test(text)) return "storage"
  if (!online) return "offline"
  if (/failed to fetch|network|load failed|timed? ?out|err_|could not locate file/.test(text))
    return "network"
  if (/bad_alloc|out of memory|allocation failed|array buffer|rangeerror/.test(text))
    return "memory"
  return "other"
}

export function withinTime<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

/** Problems that a different way of running the AI won't fix - stop and say so. */
export function isDownloadProblem(problem: ModelProblem): boolean {
  return problem === "offline" || problem === "network" || problem === "storage"
}

export function modelProblemText(problem: ModelProblem): string {
  switch (problem) {
    case "offline":
      return "You seem to be offline. Connect to the internet and try again - the AI model needs to download once."
    case "network":
      return "Couldn't download the AI model. Check your internet connection and try again."
    case "storage":
      return "Your browser is out of space for the AI model. Free up some disk space, or clear old site data, and try again."
    case "memory":
      return "Your device ran out of memory. Close other tabs and try again, or use a computer for big photos."
    case "gpu":
      return "Your graphics card couldn't run the AI. Try again, or use Chrome or Edge on a computer."
    case "other":
      return "Something went wrong while removing the background. Try again, or try another photo."
  }
}

/** RGBA pixels to three planes (R, G, B), each scaled to 0-1 and normalised as in training. */
export function rgbaToModelInput(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  spec: Pick<ModelSpec, "mean" | "std">,
): Float32Array {
  const plane = width * height
  const out = new Float32Array(plane * 3)
  const [mr, mg, mb] = spec.mean
  const [sr, sg, sb] = spec.std
  for (let i = 0; i < plane; i++) {
    const p = i * 4
    out[i] = ((rgba[p] ?? 0) / 255 - mr) / sr
    out[plane + i] = ((rgba[p + 1] ?? 0) / 255 - mg) / sg
    out[plane * 2 + i] = ((rgba[p + 2] ?? 0) / 255 - mb) / sb
  }
  return out
}

/** Below this share of real numbers, the model's answer is garbage (a GPU maths fault). */
const MIN_FINITE_SHARE = 0.99

/** Less spread than this between the lowest and highest answer means nothing stood out. */
const MIN_SPREAD = 0.05

/** Stretches IS-Net's probabilities to 0-255 (as rembg does) unless the spread is tiny. Null = mostly NaN. */
export function maskFromOutput(values: ArrayLike<number>): Uint8ClampedArray | null {
  const n = values.length
  let finite = 0
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < n; i++) {
    const v = values[i]!
    if (Number.isFinite(v)) {
      finite++
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }
  if (n === 0 || finite / n < MIN_FINITE_SHARE) return null
  const stretch = hi - lo >= MIN_SPREAD
  const from = stretch ? lo : 0
  const scale = stretch ? 255 / (hi - lo) : 255
  const out = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) {
    const v = values[i]!
    if (Number.isFinite(v)) out[i] = Math.round((v - from) * scale)
  }
  return out
}

/** Share of pixels the mask keeps (alpha over half) - 0 means it found no subject. */
export function maskCoverage(alpha: ArrayLike<number>): number {
  if (alpha.length === 0) return 0
  let kept = 0
  for (let i = 0; i < alpha.length; i++) if (alpha[i]! > 127) kept++
  return kept / alpha.length
}

/** Box blur twice (close to a Gaussian). The mask is ~1024 px, so radius 1-2 is a gentle feather. */
export function softenMask(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  const r = Math.max(0, Math.round(radius))
  if (r === 0 || width === 0 || height === 0) return alpha.slice()
  const out = alpha.slice()
  const tmp = new Uint8ClampedArray(alpha.length)
  for (let pass = 0; pass < 2; pass++) {
    boxBlur(out, tmp, width, height, r, true)
    boxBlur(tmp, out, width, height, r, false)
  }
  return out
}

function boxBlur(
  from: Uint8ClampedArray,
  to: Uint8ClampedArray,
  width: number,
  height: number,
  r: number,
  horizontal: boolean,
) {
  const lines = horizontal ? height : width
  const len = horizontal ? width : height
  const step = horizontal ? 1 : width
  const size = r * 2 + 1
  for (let line = 0; line < lines; line++) {
    const start = horizontal ? line * width : line
    const at = (k: number) => from[start + Math.min(len - 1, Math.max(0, k)) * step]!
    let sum = 0
    for (let k = -r; k <= r; k++) sum += at(k)
    for (let k = 0; k < len; k++) {
      to[start + k * step] = Math.round(sum / size)
      sum += at(k + r + 1) - at(k - r)
    }
  }
}

export function dividerForKey(key: string, value: number, shift = false): number | null {
  const step = shift ? 10 : 2
  let next: number
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      next = value - step
      break
    case "ArrowRight":
    case "ArrowUp":
      next = value + step
      break
    case "PageDown":
      next = value - 10
      break
    case "PageUp":
      next = value + 10
      break
    case "Home":
      next = 0
      break
    case "End":
      next = 100
      break
    default:
      return null
  }
  return Math.min(100, Math.max(0, next))
}

/** The bits of the WebGPU API used here (TypeScript's DOM types don't have it yet). */
interface GpuNavigator {
  gpu?: { requestAdapter(): Promise<{ features: { has(name: string): boolean } } | null> }
}

let gpuCheck: Promise<GpuSupport> | null = null

export function detectGpu(): Promise<GpuSupport> {
  gpuCheck ??= (async () => {
    try {
      const gpu = (navigator as Navigator & GpuNavigator).gpu
      const adapter = gpu ? await gpu.requestAdapter() : null
      if (!adapter) return { webgpu: false, f16: false }
      return { webgpu: true, f16: adapter.features.has("shader-f16") }
    } catch {
      return { webgpu: false, f16: false }
    }
  })()
  return gpuCheck
}

/** transformers.js keeps downloaded files in this Cache Storage bucket. */
const MODEL_CACHE = "transformers-cache"

export async function isModelCached(plan: ModelPlan): Promise<boolean> {
  try {
    if (typeof caches === "undefined") return false
    const cache = await caches.open(MODEL_CACHE)
    return (await cache.match(modelFileUrl(plan))) !== undefined
  } catch {
    return false
  }
}

export interface LoadProgress {
  /** download: from the internet; cache: the copy this browser kept; start: getting ready. */
  stage: "download" | "cache" | "start"
  loaded: number
  total: number
}

// Each model runs in its own worker with its own ONNX Runtime: a GPU failure leaves that
// runtime unusable, so the worker is thrown away and the fallback starts in a fresh one.

export type ToWorker =
  | { type: "load"; plan: ModelPlan; stage: "download" | "cache" }
  | { type: "run"; id: number; pixels: Float32Array; width: number; height: number }

export type FromWorker =
  | { type: "progress"; progress: LoadProgress }
  | { type: "ready" }
  | { type: "result"; id: number; values: Float32Array }
  | { type: "error"; id?: number; name: string; message: string }

export interface Engine {
  plan: ModelPlan
  run(pixels: Float32Array, width: number, height: number): Promise<Float32Array>
  dispose(): void
}

const engines = new Map<string, Promise<Engine>>()
const readyEngines = new Set<string>()
/** Ways of running that failed on this computer - not tried again until the page reloads. */
const brokenPlans = new Set<string>()
let progressListener: ((p: LoadProgress) => void) | null = null
const planKey = (p: ModelPlan) => `${p.device}/${p.dtype}`

export function usablePlans(gpu: GpuSupport): ModelPlan[] {
  const plans = modelPlans(gpu)
  return plans.filter((p, i) => i === plans.length - 1 || !brokenPlans.has(planKey(p)))
}

export function isEngineReady(plan: ModelPlan): boolean {
  return readyEngines.has(planKey(plan))
}

/**
 * Loaded once per page visit. The page passes `spawn` in: a worker importing a file that holds
 * its own `new Worker(new URL(...))` would make the bundler loop.
 */
export function loadEngine(
  plan: ModelPlan,
  spawn: () => Worker,
  onProgress?: (p: LoadProgress) => void,
): Promise<Engine> {
  progressListener = onProgress ?? null
  const key = planKey(plan)
  let engine = engines.get(key)
  if (!engine) {
    const loading = createEngine(plan, spawn)
    engines.set(key, loading)
    loading.then(
      () => readyEngines.add(key),
      () => {
        if (engines.get(key) === loading) engines.delete(key)
      },
    )
    engine = loading
  }
  return engine
}

/** Frees its worker and GPU memory; `broken` skips this plan for the rest of the visit. */
export function dropEngine(plan: ModelPlan, broken = false): void {
  const key = planKey(plan)
  const engine = engines.get(key)
  engines.delete(key)
  readyEngines.delete(key)
  if (broken) brokenPlans.add(key)
  engine?.then(
    (e) => e.dispose(),
    () => undefined,
  )
}

async function createEngine(plan: ModelPlan, spawn: () => Worker): Promise<Engine> {
  const stage = (await isModelCached(plan)) ? "cache" : "download"
  progressListener?.({ stage, loaded: 0, total: planFile(plan).bytes })
  const worker = spawn()

  return new Promise<Engine>((resolve, reject) => {
    const runs = new Map<
      number,
      { resolve: (v: Float32Array) => void; reject: (e: Error) => void }
    >()
    let nextRun = 0
    let ready = false
    let stopped = false

    const stop = (err: Error) => {
      if (stopped) return
      stopped = true
      worker.terminate()
      if (!ready) reject(err)
      for (const r of runs.values()) r.reject(err)
      runs.clear()
    }

    const engine: Engine = {
      plan,
      run(pixels, width, height) {
        if (stopped) return Promise.reject(new Error("The AI was stopped - try again"))
        return new Promise<Float32Array>((res, rej) => {
          const id = nextRun++
          runs.set(id, { resolve: res, reject: rej })
          const msg: ToWorker = { type: "run", id, pixels, width, height }
          worker.postMessage(msg, [pixels.buffer])
        })
      },
      dispose() {
        stop(new Error("The AI was stopped - try again"))
      },
    }

    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data
      if (m.type === "progress") {
        progressListener?.(m.progress)
      } else if (m.type === "ready") {
        ready = true
        resolve(engine)
      } else if (m.type === "result") {
        runs.get(m.id)?.resolve(m.values)
        runs.delete(m.id)
      } else {
        const err = new Error(m.message)
        err.name = m.name
        if (m.id === undefined) {
          stop(err)
        } else {
          runs.get(m.id)?.reject(err)
          runs.delete(m.id)
        }
      }
    }
    // The worker's script itself failed (e.g. it couldn't be downloaded offline).
    worker.onerror = (e) => {
      e.preventDefault()
      stop(new Error(e.message || "The AI couldn't start - check your internet connection"))
    }

    const msg: ToWorker = { type: "load", plan, stage }
    worker.postMessage(msg)
  })
}

export interface Mask {
  alpha: Uint8ClampedArray
  width: number
  height: number
  plan: ModelPlan
}

function blankCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("This image is too big for your browser - try a smaller one")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  return { canvas, ctx }
}

/** Free a canvas's memory now rather than whenever the browser gets round to it. */
function release(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

/** Big shrinks go down in halves - one big jump makes detail shimmer and edges jagged. */
function drawStretched(
  ctx: CanvasRenderingContext2D,
  src: DecodedImage,
  width: number,
  height: number,
) {
  let source: CanvasImageSource = src.image
  let w = src.width
  let h = src.height
  let step: HTMLCanvasElement | null = null
  while (w >= width * 2 && h >= height * 2) {
    const next = blankCanvas(
      Math.max(width, Math.round(w / 2)),
      Math.max(height, Math.round(h / 2)),
    )
    next.ctx.drawImage(source, 0, 0, next.canvas.width, next.canvas.height)
    if (step) release(step)
    step = next.canvas
    source = next.canvas
    w = next.canvas.width
    h = next.canvas.height
  }
  ctx.drawImage(source, 0, 0, width, height)
  if (step) release(step)
}

export function screenCopy(src: DecodedImage, maxSide: number): DecodedImage {
  const k = Math.min(1, maxSide / Math.max(src.width, src.height))
  if (k === 1) return src
  const width = Math.max(1, Math.round(src.width * k))
  const height = Math.max(1, Math.round(src.height * k))
  const { canvas, ctx } = blankCanvas(width, height)
  drawStretched(ctx, src, width, height)
  return { image: canvas, width, height }
}

export async function findMask(engine: Engine, src: DecodedImage): Promise<Mask> {
  const side = MODEL_SIDE
  const { canvas, ctx } = blankCanvas(side, side)
  // See-through parts of a PNG read as white, not black.
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, side, side)
  drawStretched(ctx, src, side, side)
  const rgba = ctx.getImageData(0, 0, side, side).data
  release(canvas)
  const values = await engine.run(rgbaToModelInput(rgba, side, side, MODEL), side, side)
  const alpha = maskFromOutput(values)
  if (!alpha) throw new Error("The graphics card gave an unusable answer")
  return { alpha, width: side, height: side, plan: engine.plan }
}

export interface CutoutLook {
  background: BackgroundChoice
  soften: boolean
}

/** How far "Soften edges" blurs the mask, in the model's pixels. */
const SOFTEN_RADIUS = 2

function maskCanvas(mask: Mask, soften: boolean): HTMLCanvasElement {
  const alpha = soften ? softenMask(mask.alpha, mask.width, mask.height, SOFTEN_RADIUS) : mask.alpha
  const { canvas, ctx } = blankCanvas(mask.width, mask.height)
  const img = ctx.createImageData(mask.width, mask.height)
  for (let i = 0; i < alpha.length; i++) img.data[i * 4 + 3] = alpha[i]!
  ctx.putImageData(img, 0, 0)
  return canvas
}

function drawBlurred(
  ctx: CanvasRenderingContext2D,
  src: DecodedImage,
  width: number,
  height: number,
) {
  // Shrink-and-stretch does most of the blur, fast in every browser; the canvas blur filter
  // (where there is one) smooths away the blockiness.
  const k = 160 / Math.max(width, height)
  const small = blankCanvas(Math.max(1, Math.round(width * k)), Math.max(1, Math.round(height * k)))
  drawStretched(small.ctx, src, small.canvas.width, small.canvas.height)
  const blur = 1.5 / k
  const pad = blur * 2
  ctx.save()
  if ("filter" in ctx) ctx.filter = `blur(${blur.toFixed(1)}px)`
  ctx.drawImage(small.canvas, -pad, -pad, width + pad * 2, height + pad * 2)
  ctx.restore()
  release(small.canvas)
}

/** `forJpg` puts white behind see-through parts. */
export function drawCutout(
  ctx: CanvasRenderingContext2D,
  src: DecodedImage,
  mask: Mask,
  width: number,
  height: number,
  look: CutoutLook,
  forJpg = false,
): void {
  const m = maskCanvas(mask, look.soften)
  const subject = blankCanvas(width, height)
  drawStretched(subject.ctx, src, width, height)
  // Keep the photo only where the mask is, the mask scaled up smoothly to the photo's size.
  subject.ctx.globalCompositeOperation = "destination-in"
  subject.ctx.drawImage(m, 0, 0, width, height)
  release(m)

  ctx.clearRect(0, 0, width, height)
  const fill = backgroundFill(look.background, forJpg)
  if (look.background.kind === "blur") drawBlurred(ctx, src, width, height)
  else if (fill) {
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(subject.canvas, 0, 0)
  release(subject.canvas)
}

export async function renderCutout(
  src: DecodedImage,
  mask: Mask,
  look: CutoutLook,
  format: "png" | "jpg",
  maxPixels: number,
): Promise<{ blob: Blob; width: number; height: number; scaled: boolean }> {
  const size = fitPixels(src.width, src.height, maxPixels)
  const { canvas, ctx } = blankCanvas(size.width, size.height)
  try {
    drawCutout(ctx, src, mask, size.width, size.height, look, format === "jpg")
    const blob =
      format === "png"
        ? await canvasToBlob(canvas, "image/png")
        : await canvasToBlob(canvas, "image/jpeg", 0.92)
    return { blob, ...size }
  } finally {
    release(canvas)
  }
}
