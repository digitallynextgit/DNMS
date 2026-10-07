/**
 * Takes the Help & Guides screenshots (features/help/guides) in the demo
 * workspace and records where each highlighted element sits.
 *
 *   pnpm help:shots                 every shot
 *   pnpm help:shots my-leave chat   only shots of those guides (or with those id prefixes)
 *   pnpm help:shots --missing       only shots not taken yet (resume a run)
 *
 * Needs:
 *   - the app running (HELP_BASE_URL, default http://localhost:3000)
 *   - the demo workspace (`pnpm db:demo`) and DEMO_PASSWORD in .env
 *   - Chrome or Edge installed (driven by playwright-core; nothing is downloaded)
 *
 * Writes public/help-shots/<id>.<hash>.webp and features/help/shots.generated.ts.
 * The content hash in the file name busts browser and image-optimiser caches
 * when a shot is retaken. A shot that fails keeps its previous picture.
 */
import "dotenv/config"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"
import sharp from "sharp"
import { format, resolveConfig } from "prettier"
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "playwright-core"
import { HELP_GUIDES } from "../features/help/guides"
import { HELP_SHOTS } from "../features/help/shots.generated"
import { DEMO_PERSONAS, demoPerson } from "../features/help/demo/dataset"
import type { DemoPersona, HelpShot, HelpShotFile, HelpTarget } from "../features/help/types"
import { DEMO_TENANT_SLUG } from "../lib/demo"

const ROOT = process.cwd()
const OUT_DIR = join(ROOT, "public", "help-shots")
const MANIFEST = join(ROOT, "features", "help", "shots.generated.ts")
const DEBUG_DIR = join(tmpdir(), "dnms-help-shots")
const BASE = (process.env.HELP_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "")
const PASSWORD = process.env.DEMO_PASSWORD

const DESKTOP = { width: 1440, height: 900, scale: 1.5 }
const MOBILE = { width: 390, height: 844, scale: 2 }
/** Room around a cropped element, CSS px. */
const CROP_MARGIN = 16
/** Room around a highlighted element, CSS px. */
const BOX_PAD = 4
/** The app's sticky top bar - anything scrolled under it is hidden. */
const TOP_BAR = 64
/** Shown instead of the local dev address (e.g. the AI connector URL). */
const PUBLIC_ORIGIN = (process.env.HELP_PUBLIC_ORIGIN ?? "https://dnms.digitallynext.com").replace(
  /\/+$/,
  "",
)
/** Pages that are only reachable signed out. */
const SIGNED_OUT = ["/login", "/forgot-password", "/signup", "/client-login"]

/** Dev overlays, toasts and motion off - every capture should look the same. */
const CAPTURE_CSS = `
  nextjs-portal, [data-nextjs-toast], [data-sonner-toaster] { display: none !important; }
  *, *::before, *::after {
    transition-duration: 0s !important; transition-delay: 0s !important;
    animation-duration: 0s !important; animation-delay: 0s !important;
    caret-color: transparent !important;
  }
  ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
`

// ── Shots to take ────────────────────────────────────────────────────────────

interface Job {
  guide: string
  shot: HelpShot
}

function collectJobs(filters: string[] = []): Job[] {
  const jobs: Job[] = []
  const seen = new Set<string>()
  for (const g of HELP_GUIDES) {
    for (const s of g.sections) {
      for (const step of s.steps ?? []) {
        if (!step.shot) continue
        if (seen.has(step.shot.id)) throw new Error(`Duplicate shot id "${step.shot.id}"`)
        seen.add(step.shot.id)
        const wanted = (f: string) => g.slug === f || step.shot!.id.startsWith(f)
        if (filters.length && !filters.some(wanted)) continue
        jobs.push({ guide: g.slug, shot: step.shot })
      }
    }
  }
  return jobs
}

// ── Browser ──────────────────────────────────────────────────────────────────

async function launch(): Promise<Browser> {
  for (const channel of ["chrome", "msedge"] as const) {
    try {
      return await chromium.launch({ channel, headless: true })
    } catch {
      // try the next installed browser
    }
  }
  throw new Error("Could not start Chrome or Edge - install one of them.")
}

async function newContext(browser: Browser, device: "desktop" | "mobile"): Promise<BrowserContext> {
  const v = device === "mobile" ? MOBILE : DESKTOP
  const context = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: v.scale,
    isMobile: device === "mobile",
    hasTouch: device === "mobile",
    colorScheme: "dark",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  })
  context.setDefaultTimeout(20_000)
  context.setDefaultNavigationTimeout(120_000) // dev server compiles on first visit
  await context.addInitScript((css: string) => {
    const add = () => {
      const style = document.createElement("style")
      style.setAttribute("data-help-capture", "")
      style.textContent = css
      document.head.appendChild(style)
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add)
    else add()
  }, CAPTURE_CSS)
  // The demo workspace stores photo ROWS only - nothing is uploaded to real
  // storage - so the picture requests are answered here with generated images.
  await context.route(DEMO_FILE_ROUTES, async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2) ?? "photo"
    await route.fulfill({ body: await placeholderPhoto(id), contentType: "image/webp" })
  })
  return context
}

/** Gallery photos and chat image attachments - served by the route above. */
const DEMO_FILE_ROUTES = /\/api\/(gallery\/photos|chat\/attachments)\/[^/]+\/file/

const photoCache = new Map<string, Buffer>()

/**
 * A simple landscape picture (sky, sun, two hills), coloured from the id so
 * every photo differs but the same photo looks the same in every shot.
 */
async function placeholderPhoto(id: string): Promise<Buffer> {
  const cached = photoCache.get(id)
  if (cached) return cached
  const h = createHash("md5").update(id).digest()
  const hue = Math.round((h[0]! / 255) * 360)
  const sunX = 200 + (h[1]! % 800)
  const ridge = 380 + (h[2]! % 120)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${hue},60%,72%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 30) % 360},70%,88%)"/>
    </linearGradient></defs>
    <rect width="1200" height="800" fill="url(#sky)"/>
    <circle cx="${sunX}" cy="230" r="70" fill="hsl(${(hue + 50) % 360},90%,92%)"/>
    <path d="M0 ${ridge} Q 300 ${ridge - 140} 600 ${ridge} T 1200 ${ridge - 40} V800 H0Z" fill="hsl(${(hue + 160) % 360},35%,45%)"/>
    <path d="M0 ${ridge + 160} Q 400 ${ridge + 40} 800 ${ridge + 150} T 1200 ${ridge + 120} V800 H0Z" fill="hsl(${(hue + 170) % 360},40%,30%)"/>
  </svg>`
  const buf = await sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer()
  photoCache.set(id, buf)
  return buf
}

async function signIn(context: BrowserContext, persona: DemoPersona): Promise<void> {
  const person = demoPerson(DEMO_PERSONAS[persona])
  const page = await context.newPage()
  await page.goto(`${BASE}/login`)
  // By name: the password input isn't tied to its <label> (no id), so a label lookup misses it.
  await page.locator('input[name="email"]').fill(person.email)
  await page.locator('input[name="password"]').fill(PASSWORD!)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 120_000 })
  await page.close()
}

/** One signed-in context per persona and device, made on first use. */
class Sessions {
  private contexts = new Map<string, BrowserContext>()
  constructor(private browser: Browser) {}

  async get(persona: DemoPersona | null, device: "desktop" | "mobile"): Promise<BrowserContext> {
    const key = `${persona ?? "signed-out"}:${device}`
    let ctx = this.contexts.get(key)
    if (!ctx) {
      ctx = await newContext(this.browser, device)
      if (persona) await signIn(ctx, persona)
      this.contexts.set(key, ctx)
    }
    return ctx
  }

  async close() {
    for (const ctx of this.contexts.values()) await ctx.close()
  }
}

// ── Page helpers ─────────────────────────────────────────────────────────────

function locate(page: Page, t: HelpTarget): Locator {
  let loc: Locator
  if ("role" in t) {
    loc = page.getByRole(t.role, t.name !== undefined ? { name: t.name, exact: t.exact } : {})
  } else if ("label" in t) {
    loc = page.getByLabel(t.label, { exact: t.exact })
  } else if ("text" in t) {
    loc = page.getByText(t.text, { exact: t.exact })
  } else if ("placeholder" in t) {
    loc = page.getByPlaceholder(t.placeholder)
  } else {
    loc = page.locator(t.css)
  }
  loc = loc.filter({ visible: true })
  const n = t.nth ?? 0
  return n === -1 ? loc.last() : loc.nth(n)
}

const describe = (t: HelpTarget) => JSON.stringify(t)

/** Wait for data to arrive: network quiet and loading skeletons gone. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {})
  await page
    .waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, null, {
      timeout: 25_000,
    })
    .catch(() => {})
  await page.waitForTimeout(500)
}

async function runActions(page: Page, shot: HelpShot): Promise<void> {
  for (const action of shot.actions ?? []) {
    if ("click" in action) await locate(page, action.click).click()
    else if ("fill" in action) await locate(page, action.fill).fill(action.value)
    else if ("hover" in action) await locate(page, action.hover).hover()
    else if ("press" in action) await page.keyboard.press(action.press)
    else if ("waitFor" in action) await locate(page, action.waitFor).waitFor({ state: "visible" })
    else await page.waitForTimeout(action.wait)
    await settle(page)
  }
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

const clampRect = (r: Rect, w: number, h: number): Rect => {
  const x = Math.max(0, r.x)
  const y = Math.max(0, r.y)
  return {
    x,
    y,
    width: Math.max(1, Math.min(w, r.x + r.width) - x),
    height: Math.max(1, Math.min(h, r.y + r.height) - y),
  }
}

/**
 * Scroll so every highlight is in the window: centre the group they form, or,
 * when it is taller than the window, start just above the first one.
 */
async function frameHighlights(page: Page, targets: HelpTarget[], viewHeight: number) {
  const boxes = (
    await Promise.all(
      targets.map((t) =>
        locate(page, t)
          .boundingBox({ timeout: 5_000 })
          .catch(() => null),
      ),
    )
  ).filter((b): b is NonNullable<typeof b> => b !== null)
  if (boxes.length === 0) return
  const top = Math.min(...boxes.map((b) => b.y))
  const bottom = Math.max(...boxes.map((b) => b.y + b.height))
  // The visible band is below the sticky top bar.
  if (top >= TOP_BAR + 8 && bottom <= viewHeight - 8) return
  const band = viewHeight - TOP_BAR
  const delta =
    bottom - top <= band - 80 ? (top + bottom) / 2 - (TOP_BAR + viewHeight) / 2 : top - TOP_BAR - 40
  await scrollAround(locate(page, targets[0]!), delta)
  await page.waitForTimeout(300)
}

/** Scroll the panel holding `el` (the app scrolls a panel, not the window) by `dy` px. */
async function scrollAround(el: Locator, dy: number): Promise<void> {
  await el.evaluate((node, delta) => {
    let n = node.parentElement
    while (n) {
      const { overflowY } = getComputedStyle(n)
      if (/(auto|scroll)/.test(overflowY) && n.scrollHeight > n.clientHeight) {
        n.scrollBy(0, delta)
        return
      }
      n = n.parentElement
    }
    window.scrollBy(0, delta)
  }, dy)
}

/**
 * Last touches before the picture: the capture CSS back in place (hydration can
 * drop the early copy), Next's dev overlays removed, the local dev address shown
 * as the public site, and the mouse moved off the page so no stray hover shows.
 */
async function polish(page: Page, keepMouse: boolean): Promise<void> {
  await page.evaluate(
    ({ css, from, to }) => {
      if (!document.querySelector("style[data-help-capture]")) {
        const style = document.createElement("style")
        style.setAttribute("data-help-capture", "")
        style.textContent = css
        document.body.appendChild(style)
      }
      document.querySelectorAll("nextjs-portal").forEach((n) => n.remove())
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.nodeValue?.includes(from)) n.nodeValue = n.nodeValue.split(from).join(to)
      }
      document.querySelectorAll<HTMLInputElement>("input, textarea").forEach((i) => {
        if (i.value.includes(from)) i.value = i.value.split(from).join(to)
      })
    },
    { css: CAPTURE_CSS, from: BASE, to: PUBLIC_ORIGIN },
  )
  if (!keepMouse) await page.mouse.move(1, 1)
  await page.waitForTimeout(200)
}

// ── One shot ─────────────────────────────────────────────────────────────────

async function capture(
  sessions: Sessions,
  job: Job,
): Promise<{ file: HelpShotFile; warnings: string[] }> {
  const { shot } = job
  const device = shot.device ?? "desktop"
  const signedOut = SIGNED_OUT.some((p) => shot.path.startsWith(p))
  const context = await sessions.get(signedOut ? null : shot.as, device)
  const page = await context.newPage()
  const warnings: string[] = []
  try {
    const url = signedOut ? `${BASE}${shot.path}` : `${BASE}/${DEMO_TENANT_SLUG}${shot.path}`
    await page.goto(url, { waitUntil: "domcontentloaded" })
    await settle(page)
    await runActions(page, shot)

    const view = page.viewportSize()!
    let clip: Rect = { x: 0, y: 0, width: view.width, height: view.height }

    if (shot.crop) {
      const el = locate(page, shot.crop)
      await el.scrollIntoViewIfNeeded()
      let box = await el.boundingBox()
      if (!box) throw new Error(`crop target not found: ${describe(shot.crop)}`)
      // Dialogs float above the bar; anything else must not sit under it.
      if (box.y < TOP_BAR + CROP_MARGIN && box.height < view.height - TOP_BAR) {
        const isOverlay = await el.evaluate(
          (n) => !!n.closest("[role=dialog],[role=alertdialog],[role=menu],[role=listbox]"),
        )
        if (!isOverlay) {
          await scrollAround(el, box.y - TOP_BAR - CROP_MARGIN)
          await page.waitForTimeout(300)
          box = (await el.boundingBox()) ?? box
        }
      }
      clip = clampRect(
        {
          x: box.x - CROP_MARGIN,
          y: box.y - CROP_MARGIN,
          width: box.width + CROP_MARGIN * 2,
          height: box.height + CROP_MARGIN * 2,
        },
        view.width,
        view.height,
      )
    } else if (shot.highlight?.length) {
      await frameHighlights(page, shot.highlight, view.height)
    }

    const boxes: HelpShotFile["boxes"] = []
    for (const target of shot.highlight ?? []) {
      const box = await locate(page, target)
        .boundingBox({ timeout: 5_000 })
        .catch(() => null)
      if (!box) {
        // Keep the slot, so box 3 is still "3" when box 2 can't be found.
        warnings.push(`highlight not found: ${describe(target)}`)
        boxes.push(null)
        continue
      }
      const r = clampRect(
        {
          x: box.x - BOX_PAD - clip.x,
          y: box.y - BOX_PAD - clip.y,
          width: box.width + BOX_PAD * 2,
          height: box.height + BOX_PAD * 2,
        },
        clip.width,
        clip.height,
      )
      const round = (n: number) => Math.round(n * 10_000) / 10_000
      boxes.push({
        x: round(r.x / clip.width),
        y: round(r.y / clip.height),
        w: round(r.width / clip.width),
        h: round(r.height / clip.height),
      })
    }

    const last = shot.actions?.at(-1)
    await polish(page, !!last && "hover" in last)
    const png = await page.screenshot({ clip, type: "png" })
    const webp = await sharp(png).webp({ quality: 80, effort: 5 }).toBuffer()
    const meta = await sharp(webp).metadata()
    const hash = createHash("sha256").update(webp).digest("hex").slice(0, 8)

    // Older versions of this shot are removed by writeManifest, once the
    // manifest points at the new file - never before.
    const name = `${shot.id}.${hash}.webp`
    writeFileSync(join(OUT_DIR, name), webp)

    return {
      file: { src: `/help-shots/${name}`, width: meta.width!, height: meta.height!, boxes },
      warnings,
    }
  } catch (err) {
    mkdirSync(DEBUG_DIR, { recursive: true })
    await page.screenshot({ path: join(DEBUG_DIR, `${shot.id}.png`) }).catch(() => {})
    throw err
  } finally {
    await page.close()
  }
}

// ── Manifest ─────────────────────────────────────────────────────────────────

async function writeManifest(shots: Record<string, HelpShotFile>): Promise<void> {
  const sorted = Object.fromEntries(Object.entries(shots).sort(([a], [b]) => a.localeCompare(b)))
  const source = `// AUTO-GENERATED by scripts/help-screenshots.ts - DO NOT EDIT BY HAND.
// Re-generate with \`pnpm help:shots\` (needs the demo workspace: \`pnpm db:demo\`).
import type { HelpShotFile } from "./types"

export const HELP_SHOTS: Readonly<Record<string, HelpShotFile>> = ${JSON.stringify(sorted, null, 2)}
`
  const formatted = await format(source, { ...(await resolveConfig(MANIFEST)), filepath: MANIFEST })
  writeFileSync(MANIFEST, formatted)
  // Now that the manifest is saved, drop superseded versions of retaken shots.
  for (const name of readdirSync(OUT_DIR)) {
    const id = name.split(".")[0]!
    if (shots[id] && shots[id].src !== `/help-shots/${name}`) unlinkSync(join(OUT_DIR, name))
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

/** Fail fast if HELP_BASE_URL is not DNMS (another app on the port, or nothing). */
async function assertDnmsServer(): Promise<void> {
  const res = await fetch(`${BASE}/login`).catch(() => null)
  const html = res ? await res.text() : ""
  if (!res?.ok || !html.includes("DNMS")) {
    throw new Error(
      `${BASE} is not serving DNMS (got ${res ? res.status : "no answer"}). Start \`pnpm dev\` for this project, or set HELP_BASE_URL.`,
    )
  }
}

async function main() {
  if (!PASSWORD) throw new Error("DEMO_PASSWORD is not set in .env (see `pnpm db:demo`).")
  const args = process.argv.slice(2)
  const missingOnly = args.includes("--missing")
  const filters = args.filter((a) => !a.startsWith("--"))
  const taken = (id: string) =>
    !!HELP_SHOTS[id] && existsSync(join(ROOT, "public", HELP_SHOTS[id].src))
  const jobs = collectJobs(filters).filter((j) => !missingOnly || !taken(j.shot.id))
  if (jobs.length === 0) {
    console.log(filters.length ? `No shots match ${filters.join(", ")}.` : "Nothing to take.")
    return
  }
  await assertDnmsServer()
  mkdirSync(OUT_DIR, { recursive: true })

  // Group by persona + device so each signed-in session is reused.
  jobs.sort((a, b) =>
    `${a.shot.as}:${a.shot.device ?? ""}`.localeCompare(`${b.shot.as}:${b.shot.device ?? ""}`),
  )

  // Entries whose picture is gone (an interrupted run) count as not taken.
  const shots: Record<string, HelpShotFile> = Object.fromEntries(
    Object.entries(HELP_SHOTS).filter(([, f]) => existsSync(join(ROOT, "public", f.src))),
  )
  const failed: string[] = []
  const browser = await launch()
  const sessions = new Sessions(browser)
  const started = Date.now()

  try {
    for (const [i, job] of jobs.entries()) {
      const label = `[${i + 1}/${jobs.length}] ${job.shot.id}`
      try {
        const { file, warnings } = await capture(sessions, job)
        shots[job.shot.id] = file
        // Saved as we go, so a run that is cut short keeps what it took.
        if (i % 5 === 4) await writeManifest(shots)
        console.log(`${label} ok${warnings.length ? ` - ${warnings.join("; ")}` : ""}`)
        if (warnings.length) failed.push(`${job.shot.id}: ${warnings.join("; ")}`)
      } catch (err) {
        const message = err instanceof Error ? err.message.split("\n")[0] : String(err)
        console.log(`${label} FAILED - ${message}`)
        failed.push(`${job.shot.id}: ${message}`)
      }
    }
  } finally {
    await sessions.close()
    await browser.close()
  }

  // A full run also forgets shots whose guide step no longer exists.
  if (!filters.length && !missingOnly) {
    const live = new Set(collectJobs().map((j) => j.shot.id))
    for (const id of Object.keys(shots)) if (!live.has(id)) delete shots[id]
    for (const name of readdirSync(OUT_DIR)) {
      const id = name.split(".")[0]!
      if (!live.has(id) || shots[id]?.src !== `/help-shots/${name}`) unlinkSync(join(OUT_DIR, name))
    }
  }
  await writeManifest(shots)

  const secs = Math.round((Date.now() - started) / 1000)
  console.log(`\n[help:shots] ${jobs.length - failed.length}/${jobs.length} clean in ${secs}s`)
  console.log(`[help:shots] manifest → ${relative(ROOT, MANIFEST)}`)
  if (failed.length) {
    console.log(`\nNeeds attention (debug pictures in ${DEBUG_DIR}):`)
    for (const f of failed) console.log(`  - ${f}`)
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
