/**
 * M3 URL-space verification.
 *
 *   npx tsx scripts/verify-tenant-urls.ts
 *
 * Pure string logic, no database. It runs on three things:
 *
 *   1. The table of cases below - what each function must do, spelled out.
 *   2. DRIFT: every folder under app/(dashboard) must be listed as
 *      tenant-scoped. Add a route, forget the list, and its links silently stop
 *      carrying the prefix - this catches that at check time instead of in a
 *      customer's URL bar.
 *   3. SAFETY: no route segment may be claimable as a company slug, or that
 *      company would shadow the route for everybody.
 */
import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import {
  GLOBAL_SEGMENTS,
  TENANT_SCOPED_SEGMENTS,
  isTenantScoped,
  looksLikeSlug,
  splitTenant,
  withTenant,
} from "../lib/tenant-url"
import { RESERVED_SLUGS } from "../server/tenants"

let failures = 0
const ok = (s: string) => console.log(`  ✓ ${s}`)
const bad = (s: string) => {
  console.log(`  ✗ ${s}`)
  failures++
}
function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) ok(`${label} → ${a}`)
  else bad(`${label}\n      expected ${e}\n      got      ${a}`)
}

console.log("\n== splitTenant ==")
eq('"/digitallynext/projects/7"', splitTenant("/digitallynext/projects/7"), {
  slug: "digitallynext",
  rest: "/projects/7",
})
eq('"/digitallynext"', splitTenant("/digitallynext"), { slug: "digitallynext", rest: "/" })
eq('"/digitallynext/"', splitTenant("/digitallynext/"), { slug: "digitallynext", rest: "/" })
// A route segment is never a slug, however slug-shaped it looks.
eq('"/projects/7" (route, not a slug)', splitTenant("/projects/7"), {
  slug: null,
  rest: "/projects/7",
})
eq('"/login"', splitTenant("/login"), { slug: null, rest: "/login" })
eq('"/api/employees"', splitTenant("/api/employees"), { slug: null, rest: "/api/employees" })
eq('"/"', splitTenant("/"), { slug: null, rest: "/" })
// Files at the root have a dot, which the slug pattern rejects - so a static
// asset can never be mistaken for a company.
eq('"/logo_dark_bg.webp"', splitTenant("/logo_dark_bg.webp"), {
  slug: null,
  rest: "/logo_dark_bg.webp",
})
eq('"/theme-boot.js"', splitTenant("/theme-boot.js"), { slug: null, rest: "/theme-boot.js" })
// Too short / malformed to be a slug.
eq('"/ab/x" (2 chars)', splitTenant("/ab/x"), { slug: null, rest: "/ab/x" })
eq('"/-lead/x"', splitTenant("/-lead/x"), { slug: null, rest: "/-lead/x" })
eq('"/UPPER/x"', splitTenant("/UPPER/x"), { slug: null, rest: "/UPPER/x" })

console.log("\n== withTenant ==")
eq("app path gets the prefix", withTenant("/projects", "acme"), "/acme/projects")
eq("nested app path", withTenant("/projects/7/tasks", "acme"), "/acme/projects/7/tasks")
eq(
  "query string survives",
  withTenant("/leave/types?tab=policy", "acme"),
  "/acme/leave/types?tab=policy",
)
eq("fragment survives", withTenant("/docs#top", "acme"), "/acme/docs#top")
eq("portal is tenant-scoped too", withTenant("/portal/abc", "acme"), "/acme/portal/abc")
eq("IDEMPOTENT - already prefixed", withTenant("/acme/projects", "acme"), "/acme/projects")
eq("global: /login untouched", withTenant("/login", "acme"), "/login")
eq("global: /api untouched", withTenant("/api/employees", "acme"), "/api/employees")
eq("global: root untouched", withTenant("/", "acme"), "/")
eq(
  "global: /select-workspace untouched",
  withTenant("/select-workspace", "acme"),
  "/select-workspace",
)
eq("no slug → unchanged", withTenant("/projects", null), "/projects")
eq("external URL untouched", withTenant("https://x.com/projects", "acme"), "https://x.com/projects")
eq("anchor untouched", withTenant("#section", "acme"), "#section")
eq("mailto untouched", withTenant("mailto:a@b.c", "acme"), "mailto:a@b.c")
eq("relative untouched", withTenant("settings", "acme"), "settings")

console.log("\n== round trip: prefix then strip returns the original ==")
{
  let roundTripped = 0
  for (const segment of TENANT_SCOPED_SEGMENTS) {
    const original = `/${segment}/deep/path?q=1`
    const split = splitTenant(withTenant(original, "acme"))
    if (split.slug === "acme" && split.rest === `/${segment}/deep/path?q=1`) roundTripped++
    else bad(`${original} did not round-trip: ${JSON.stringify(split)}`)
  }
  if (roundTripped === TENANT_SCOPED_SEGMENTS.size)
    ok(`all ${roundTripped} tenant-scoped segments round-trip`)
}

console.log("\n== drift: every app route is declared tenant-scoped ==")
{
  const dashboardDir = join(process.cwd(), "app", "(dashboard)")
  const folders = readdirSync(dashboardDir).filter((entry) =>
    statSync(join(dashboardDir, entry)).isDirectory(),
  )
  const undeclared = folders.filter((f) => !TENANT_SCOPED_SEGMENTS.has(f))
  if (undeclared.length === 0) {
    ok(`all ${folders.length} folders under app/(dashboard) are tenant-scoped`)
  } else {
    bad(
      `NOT in TENANT_SCOPED_SEGMENTS: ${undeclared.join(", ")}\n` +
        `      Their links will not carry the tenant prefix. Add them to lib/tenant-url.ts.`,
    )
  }
  // And nothing declared that no longer exists.
  const gone = [...TENANT_SCOPED_SEGMENTS].filter((s) => s !== "portal" && !folders.includes(s))
  if (gone.length === 0) ok("no stale entries in TENANT_SCOPED_SEGMENTS")
  else bad(`declared but no such route folder: ${gone.join(", ")}`)
}

console.log("\n== drift: every public/ directory is declared global ==")
{
  // This is the check that was missing when /avatars broke. A directory under
  // public/ has no extension, so the slug pattern accepts it and the proxy
  // strips it as a tenant prefix - every file beneath it 404s. Files are safe
  // without listing (their extension has a dot), directories are not.
  const publicDir = join(process.cwd(), "public")
  const dirs = readdirSync(publicDir).filter((entry) =>
    statSync(join(publicDir, entry)).isDirectory(),
  )
  const unlisted = dirs.filter((d) => looksLikeSlug(d))
  if (unlisted.length === 0) {
    ok(`all ${dirs.length} public/ directories (${dirs.join(", ")}) are safe from slug-stripping`)
  } else {
    bad(
      `public/ directories readable as a tenant slug: ${unlisted.join(", ")}\n` +
        `      Every file under them would 404. Add them to GLOBAL_SEGMENTS in lib/tenant-url.ts.`,
    )
  }

  // The paths themselves, end to end.
  for (const dir of dirs) {
    const probe = `/${dir}/some-file.webp`
    const split = splitTenant(probe)
    if (split.slug !== null) {
      bad(`${probe} is split as tenant "${split.slug}" - the file will not be served`)
    }
  }
}

console.log("\n== safety: no route segment is claimable as a company slug ==")
{
  const claimable = [...TENANT_SCOPED_SEGMENTS, ...GLOBAL_SEGMENTS].filter((s) => looksLikeSlug(s))
  if (claimable.length === 0) ok("looksLikeSlug() rejects every route segment")
  else bad(`these would be accepted as slugs and would shadow a route: ${claimable.join(", ")}`)

  const unreserved = [...TENANT_SCOPED_SEGMENTS, ...GLOBAL_SEGMENTS].filter(
    (s) => !RESERVED_SLUGS.has(s),
  )
  if (unreserved.length === 0) ok("RESERVED_SLUGS covers every route segment")
  else bad(`signup would allow these route names: ${unreserved.join(", ")}`)

  // A real slug must still be usable, or the guard is too broad.
  const realistic = ["acme", "digitallynext", "north-star-media", "abc", "a1b2"]
  const rejected = realistic.filter((s) => !looksLikeSlug(s))
  if (rejected.length === 0) ok(`ordinary company names still validate (${realistic.join(", ")})`)
  else bad(`these legitimate slugs were rejected: ${rejected.join(", ")}`)
}

console.log("\n== isTenantScoped ==")
eq('"/dashboard"', isTenantScoped("/dashboard"), true)
eq('"/portal/x"', isTenantScoped("/portal/x"), true)
eq('"/login"', isTenantScoped("/login"), false)
eq('"/api/x"', isTenantScoped("/api/x"), false)
eq('"/"', isTenantScoped("/"), false)

console.log(failures === 0 ? "\nURL space verified.\n" : `\n${failures} check(s) FAILED.\n`)
process.exitCode = failures === 0 ? 0 : 1
