/**
 * UI audit - fetches every page and inspects the RENDERED HTML.
 *
 *   pnpm build && TENANT_ENFORCEMENT=strict PORT=3111 pnpm start
 *   BASE=http://localhost:3111 npx tsx --conditions=react-server scripts/audit-ui.ts
 *
 * Complements scripts/health-check.ts. That one asks "did it return 200"; this
 * one asks "is what came back any good" - accessibility names, heading order,
 * labelled inputs, duplicate ids, tables that will scroll the page sideways.
 *
 * Every check is written to be LOW FALSE POSITIVE. A noisy audit gets ignored,
 * and an ignored audit is worse than none: it converts a real finding into a
 * line somebody has learned to scroll past. Where a rule cannot be applied
 * confidently from HTML alone it is left out rather than guessed at.
 *
 * Read-only: every request is a GET.
 */
import "dotenv/config"
import { encode } from "next-auth/jwt"
import { db } from "@/server/db"
import { FOUNDING_TENANT_ID, runUnscoped } from "@/server/tenant-context"
import { loadActiveMemberships } from "@/server/identity"
import { LEGAL_INDEX } from "@/features/marketing/legal.content"

const BASE = process.env.BASE ?? "http://localhost:3111"
const COOKIE_NAME = "authjs.session-token"

/** Public pages, checked signed OUT - the state a visitor is actually in. */
const PUBLIC_PAGES = [
  "/",
  "/about",
  "/contact",
  "/pricing",
  "/faq",
  "/login",
  "/signup",
  ...LEGAL_INDEX.map((d) => `/legal/${d.slug}`),
]

/** App pages, checked signed IN as an admin. Tenant prefix added at run time. */
const APP_PAGES = [
  "/dashboard",
  "/attendance",
  "/attendance/me",
  "/attendance/attendance-directory",
  "/employees",
  "/employees/employee-directory",
  "/employees/org-chart",
  "/leave",
  "/leave/apply",
  "/payroll",
  "/payroll/me",
  "/performance",
  "/projects",
  "/projects/my-tasks",
  "/recruitment",
  "/documents",
  "/gallery",
  "/announcements",
  "/notifications",
  "/profile",
  "/chat",
  "/holidays",
  "/wfh",
  "/referrals",
  "/resignations",
  "/analytics",
  "/admin/roles",
  "/admin/permissions",
  "/admin/audit-log",
  "/admin/careers",
  "/admin/storage",
  "/more",
]

interface Finding {
  page: string
  rule: string
  detail: string
}
const findings: Finding[] = []
const add = (page: string, rule: string, detail: string) => findings.push({ page, rule, detail })

// ---------------------------------------------------------------------------
// Tiny HTML helpers. A real parser would be better, but pulling one in for an
// audit script is a dependency the app then carries forever; these are scoped
// to the specific shapes the checks need and are deliberately conservative.
// ---------------------------------------------------------------------------

/** Strip <script>, <style> and RSC flight payloads before inspecting markup. */
function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`, "i"))
  return m ? (m[1] ?? "") : null
}

/** Visible text of an element, given the full HTML and the tag's end offset. */
function innerText(html: string, from: number, tagName: string): string {
  const close = html.indexOf(`</${tagName}`, from)
  if (close === -1) return ""
  return html
    .slice(from, close)
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// ---------------------------------------------------------------------------
// The checks.
// ---------------------------------------------------------------------------

function checkImages(page: string, html: string) {
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0]
    const alt = attr(tag, "alt")
    const src = attr(tag, "src") ?? "(no src)"
    // alt="" is CORRECT for decorative images. Only a MISSING alt is a defect.
    if (alt === null)
      add(page, "img-no-alt", `<img src="${src.slice(0, 70)}"> has no alt attribute`)
  }
}

function checkAccessibleNames(page: string, html: string) {
  // A control with neither text nor an aria-label is unreachable by screen
  // reader and unlabelled in the accessibility tree.
  for (const tagName of ["button", "a"] as const) {
    const re = new RegExp(`<${tagName}\\b[^>]*>`, "gi")
    for (const m of html.matchAll(re)) {
      const tag = m[0]
      const end = m.index + tag.length
      if (attr(tag, "aria-label")) continue
      if (attr(tag, "aria-labelledby")) continue
      if (attr(tag, "aria-hidden") === "true") continue
      if (tagName === "a" && attr(tag, "href") === null) continue // not a link
      const text = innerText(html, end, tagName)
      if (text.length > 0) continue
      // An icon-only control often labels itself through a nested <svg
      // aria-label> or <title>; treat a nested title as a name.
      const close = html.indexOf(`</${tagName}`, end)
      const inner = close === -1 ? "" : html.slice(end, close)
      if (/<title>/i.test(inner)) continue
      const hint = attr(tag, "href") ?? attr(tag, "class")?.slice(0, 50) ?? ""
      add(page, "control-no-name", `<${tagName}> with no text and no aria-label (${hint})`)
    }
  }
}

function checkInputs(page: string, html: string) {
  const labelFor = new Set<string>()
  for (const m of html.matchAll(/<label\b[^>]*>/gi)) {
    const f = attr(m[0], "for")
    if (f) labelFor.add(f)
  }
  for (const m of html.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const tag = m[0]
    const type = (attr(tag, "type") ?? "text").toLowerCase()
    if (["hidden", "submit", "button", "reset", "image"].includes(type)) continue
    if (attr(tag, "aria-label") || attr(tag, "aria-labelledby")) continue
    const id = attr(tag, "id")
    if (id && labelFor.has(id)) continue
    const name = attr(tag, "name") ?? attr(tag, "placeholder") ?? type
    add(page, "input-no-label", `<${m[1]}> "${name}" has no label, aria-label or aria-labelledby`)
  }
}

function checkHeadings(page: string, html: string) {
  const levels: number[] = []
  for (const m of html.matchAll(/<h([1-6])\b[^>]*>/gi)) levels.push(Number(m[1]))
  const h1s = levels.filter((l) => l === 1).length
  if (h1s === 0) {
    // This inspects the SERVER-RENDERED html. A page whose data loads on the
    // client renders a <Skeleton> title first, and PageHeader deliberately
    // wraps a non-string title in a div rather than an <h1> (a div inside an
    // h1's phrasing content would be invalid and break hydration). So this is
    // "no h1 on first paint", not necessarily "no h1 ever" - worth knowing for
    // screen-reader landmark navigation, not a rendering bug.
    const skeleton = /animate-pulse|Skeleton|bg-muted[^"]*rounded/.test(html)
    add(
      page,
      "heading-no-h1",
      skeleton
        ? "no <h1> in the server HTML (renders a loading skeleton first)"
        : "page has no <h1> at all",
    )
  }
  if (h1s > 1) add(page, "heading-many-h1", `page has ${h1s} <h1> elements`)
  for (let i = 1; i < levels.length; i++) {
    const prev = levels[i - 1]!
    const cur = levels[i]!
    if (cur > prev + 1) {
      add(page, "heading-skip", `jumps from h${prev} to h${cur}`)
      break // one report per page is enough to act on
    }
  }
}

function checkDuplicateIds(page: string, html: string) {
  const seen = new Map<string, number>()
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) {
    const id = m[1]!
    seen.set(id, (seen.get(id) ?? 0) + 1)
  }
  const dupes = [...seen.entries()].filter(([, n]) => n > 1)
  // React itself emits repeated ids for some internals; report only ours.
  const ours = dupes.filter(([id]) => !id.startsWith("_") && !/^:/.test(id))
  for (const [id, n] of ours.slice(0, 3)) {
    add(
      page,
      "duplicate-id",
      `id="${id}" appears ${n} times - labels and anchors will target the wrong one`,
    )
  }
}

function checkWideContent(page: string, html: string) {
  // A <table> with no scrollable ancestor makes the whole page scroll sideways
  // on a narrow screen. Detected by looking backwards from the table for a
  // container that can scroll.
  for (const m of html.matchAll(/<table\b[^>]*>/gi)) {
    const before = html.slice(Math.max(0, m.index - 400), m.index)
    if (/overflow-x-auto|overflow-auto|overflow-x-scroll|overflow-hidden/.test(before)) continue
    add(page, "table-no-scroll-container", "a <table> has no overflow-x container within 400 chars")
    break
  }
}

function checkThemeTokens(page: string, html: string, themeable: boolean) {
  // Only run where theming actually applies. The marketing site is pinned to
  // dark and uses a fixed palette of deliberate accents (the brand red, plus a
  // blue and an amber in the hero chips), so "does not follow the theme" is not
  // a defect there - it is the design. Inside the app, where eight palettes can
  // be applied, an inline hex genuinely will not follow them.
  if (!themeable) return
  const KNOWN = new Set(["#ef4444"])
  const bad = new Set<string>()
  for (const m of html.matchAll(/style="[^"]*?(#[0-9a-f]{6})\b[^"]*"/gi)) {
    const hex = m[1]!.toLowerCase()
    if (!KNOWN.has(hex)) bad.add(hex)
  }
  if (bad.size > 0) {
    add(
      page,
      "hardcoded-colour",
      `inline colours not from the brand token: ${[...bad].slice(0, 5).join(", ")}`,
    )
  }
}

// ---------------------------------------------------------------------------

async function adminCookie(): Promise<{ cookie: string; slug: string; who: string }> {
  const e = await runUnscoped("ui audit", () =>
    db.employee.findFirst({
      // PINNED TO THE FOUNDING TENANT, and that matters.
      //
      // An unscoped findFirst() for "an active admin" returned whichever row
      // came first - and once a second company signed up, that was THEIR admin.
      // Every check then ran against a one-employee workspace with no projects,
      // no payroll and no attendance: pages returned 200 because they render
      // fine when empty, so the sweep stayed green while testing almost nothing.
      where: {
        isActive: true,
        tenantId: FOUNDING_TENANT_ID,
        employeeRoles: { some: { role: { name: "admin" } } },
      },
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePhoto: true,
        employeeRoles: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
      },
    }),
  )
  if (!e) throw new Error("no admin to audit as")
  const own = await runUnscoped("ui audit", () =>
    db.membership.findUnique({ where: { employeeId: e.id }, select: { userId: true } }),
  )
  const m = (await loadActiveMemberships(own!.userId))[0]!
  const roles = e.employeeRoles.map((r) => r.role.name)
  const permissions = [
    ...new Set(
      e.employeeRoles.flatMap((r) => r.role.rolePermissions.map((p) => p.permission.scope)),
    ),
  ]
  const jwt = await encode({
    token: {
      id: e.id,
      userId: own!.userId,
      membershipId: m.id,
      tenantId: m.tenantId,
      tenantSlug: m.tenantSlug,
      kind: "employee",
      employeeNo: e.employeeNo,
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      profilePhoto: e.profilePhoto,
      roles,
      permissions,
      mustChangePassword: false,
      checkedAt: Date.now(),
      sub: e.id,
    },
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET!,
    salt: COOKIE_NAME,
    maxAge: 2592000,
  })
  return {
    cookie: `${COOKIE_NAME}=${jwt}`,
    slug: m.tenantSlug,
    who: `${e.employeeNo} [${roles.join(", ")}]`,
  }
}

async function auditPage(page: string, url: string, cookie?: string, themeable = false) {
  const res = await fetch(url, { headers: cookie ? { cookie } : {}, redirect: "manual" })
  if (res.status !== 200) {
    add(page, "not-200", `${res.status} ${res.headers.get("location") ?? ""}`)
    return
  }
  const html = cleanHtml(await res.text())
  checkImages(page, html)
  checkAccessibleNames(page, html)
  checkInputs(page, html)
  checkHeadings(page, html)
  checkDuplicateIds(page, html)
  checkWideContent(page, html)
  checkThemeTokens(page, html, themeable)
}

async function main() {
  console.log(`\nUI AUDIT - ${BASE}`)
  console.log("=".repeat(78))

  console.log(`\n-- Public pages (signed out): ${PUBLIC_PAGES.length} --`)
  for (const p of PUBLIC_PAGES) await auditPage(p, `${BASE}${p}`)

  const { cookie, slug, who } = await adminCookie()
  console.log(`-- App pages (signed in as ${who}): ${APP_PAGES.length} --`)
  for (const p of APP_PAGES) await auditPage(p, `${BASE}/${slug}${p}`, cookie, true)

  // ---- Report, grouped by rule so one fix closes many lines ---------------
  console.log("\n" + "=".repeat(78))
  if (findings.length === 0) {
    console.log("No UI findings.\n")
    await db.$disconnect()
    return
  }

  const byRule = new Map<string, Finding[]>()
  for (const f of findings) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, [])
    byRule.get(f.rule)!.push(f)
  }
  const ordered = [...byRule.entries()].sort((a, b) => b[1].length - a[1].length)

  console.log(`${findings.length} finding(s) across ${byRule.size} rule(s)\n`)
  for (const [rule, list] of ordered) {
    const pages = [...new Set(list.map((f) => f.page))]
    console.log(`-- ${rule} -- ${list.length} on ${pages.length} page(s)`)
    // Show the distinct details, not every repetition of the same one.
    const distinct = [...new Set(list.map((f) => f.detail))]
    for (const d of distinct.slice(0, 4)) console.log(`     ${d}`)
    if (distinct.length > 4) console.log(`     ... and ${distinct.length - 4} more variants`)
    console.log(
      `     pages: ${pages.slice(0, 6).join(", ")}${pages.length > 6 ? ` +${pages.length - 6}` : ""}`,
    )
    console.log()
  }

  await db.$disconnect()
}

main()
