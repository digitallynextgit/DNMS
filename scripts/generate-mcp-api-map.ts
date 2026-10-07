/**
 * Generates features/mcp/server/api-routes.generated.ts - the catalogue of DNMS
 * API routes the AI connector can call on a person's behalf.
 *
 *   pnpm mcp:api-map        (also runs before `pnpm dev` and `pnpm build`)
 *
 * For each app/api/** /route.ts it records the path, exported methods, the
 * route's own doc comments ("// GET /api/leave/requests?status=&..."), query
 * parameters it reads, body fields (from an inline `as {...}` type or the zod
 * schema its service validates with) and the permission withAuth requires.
 * That metadata is what lets Claude/ChatGPT find the right endpoint.
 *
 * Routes excluded by features/mcp/server/api-policy.ts never make it into the
 * catalogue (machine/public endpoints, the client portal, credential changes,
 * streams, the platform/superadmin surface, secret-revealing methods). The
 * dispatcher re-checks the same policy at runtime.
 *
 * Best-effort static analysis: when it can't work something out it leaves the
 * field empty - the route's own validation still tells the AI what is wrong.
 * It never fails the build: on error it keeps the previous file.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"
import { format, resolveConfig } from "prettier"

const ROOT = process.cwd()
const APP_DIR = join(ROOT, "app")
const API_DIR = join(APP_DIR, "api")
const OUT = join(ROOT, "features", "mcp", "server", "api-routes.generated.ts")

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
type Method = (typeof HTTP_METHODS)[number]

// What is never reachable lives in ONE place, shared with the runtime check.
import { exclusionReason } from "../features/mcp/server/api-policy"

// ---------------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name === "route.ts") out.push(full)
  }
  return out
}

function routePath(file: string): string {
  const rel = relative(APP_DIR, dirname(file)).split(sep)
  return "/" + rel.filter((s) => !(s.startsWith("(") && s.endsWith(")"))).join("/")
}

function importSpecifier(file: string): string {
  return "@/" + relative(ROOT, file).split(sep).join("/").replace(/\.ts$/, "")
}

/** name → resolved file path, from a module's import statements. */
function importsOf(src: string, file: string): Map<string, string> {
  const map = new Map<string, string>()
  const re = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g
  for (const m of src.matchAll(re)) {
    const resolved = resolveModule(m[2]!, file)
    if (!resolved) continue
    for (const part of m[1]!.split(",")) {
      const [orig, alias] = part.trim().split(/\s+as\s+/)
      const name = (alias ?? orig ?? "").trim()
      if (name) map.set(name, resolved)
    }
  }
  return map
}

function resolveModule(spec: string, from: string): string | null {
  let base: string
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2))
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec)
  else return null
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

const fileCache = new Map<string, string>()
function read(file: string): string {
  let src = fileCache.get(file)
  if (src === undefined) {
    src = readFileSync(file, "utf8")
    fileCache.set(file, src)
  }
  return src
}

/** Index of the bracket matching the opener at `open`. */
function matchBracket(src: string, open: number): number {
  const pairs: Record<string, string> = { "{": "}", "(": ")", "[": "]" }
  const stack: string[] = []
  let quote: string | null = null
  for (let i = open; i < src.length; i++) {
    const c = src[i]!
    if (quote) {
      if (c === "\\") i++
      else if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'" || c === "`") quote = c
    else if (c === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i)
      i = nl === -1 ? src.length : nl
    } else if (pairs[c]) stack.push(pairs[c]!)
    else if (c === "}" || c === ")" || c === "]") {
      stack.pop()
      if (stack.length === 0) return i
    }
  }
  return -1
}

/** Split an object-literal body into its top-level `key: value` entries. */
function topLevelEntries(body: string): Array<[string, string]> {
  const entries: Array<[string, string]> = []
  let depth = 0
  let quote: string | null = null
  let start = 0
  const flush = (end: number) => {
    const chunk = body
      .slice(start, end)
      .replace(/\/\/[^\n]*/g, "")
      .trim()
    const m = chunk.match(/^([A-Za-z_$][\w$]*)(\??)\s*:\s*([\s\S]*)$/)
    if (m) entries.push([m[1]! + m[2]!, m[3]!.replace(/\s+/g, " ").trim()])
  }
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!
    if (quote) {
      if (c === "\\") i++
      else if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'" || c === "`") quote = c
    else if (c === "/" && body[i + 1] === "/") {
      const nl = body.indexOf("\n", i)
      i = nl === -1 ? body.length : nl
    } else if ("{([".includes(c)) depth++
    else if ("})]".includes(c)) depth--
    else if ((c === "," || c === ";" || c === "\n") && depth === 0) {
      flush(i)
      start = i + 1
    }
  }
  flush(body.length)
  return entries
}

/** "z.string().min(1).optional()" → "string?"; enums keep their values. */
function describeZod(key: string, expr: string): string {
  const optional = /\.(optional|nullish|default)\(/.test(expr) || key.endsWith("?")
  const name = key.replace(/\?$/, "")
  let type = "any"
  const enumMatch = expr.match(/z\.enum\(\s*\[([^\]]*)\]/)
  const nativeEnum = expr.match(/z\.nativeEnum\((\w+)\)/)
  const base = expr.match(/z\.(?:coerce\.)?(\w+)\(/)
  if (enumMatch) type = enumMatch[1]!.replace(/\s+/g, "").replace(/,/g, "|")
  else if (nativeEnum) type = nativeEnum[1]!
  else if (base) type = base[1]!
  if (/^z\.array\(/.test(expr)) {
    const inner = expr.match(/^z\.array\(\s*z\.(?:coerce\.)?(\w+)/)
    type = `${inner?.[1] ?? "any"}[]`
  }
  return `${name}${optional ? "?" : ""}: ${type}`
}

/** Resolve a zod schema identifier to "a: string, b?: number, ...". */
function schemaFields(name: string, file: string, depth = 0): string[] | null {
  if (depth > 4) return null
  const src = read(file)
  const decl = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*(?::[^=]+)?=\\s*`).exec(src)
  if (!decl) {
    const from = importsOf(src, file).get(name)
    return from && from !== file ? schemaFields(name, from, depth + 1) : null
  }
  const exprStart = decl.index + decl[0].length
  const rest = src.slice(exprStart, exprStart + 4000)

  // z.object({...}) possibly followed by modifiers
  const obj = /^z\s*\.\s*object\(\s*\{/.exec(rest)
  if (obj) {
    const open = exprStart + rest.indexOf("{")
    const close = matchBracket(src, open)
    if (close === -1) return null
    const fields = topLevelEntries(src.slice(open + 1, close)).map(([k, v]) => describeZod(k, v))
    const after = src.slice(close, close + 200)
    return /^\}\s*\)\s*\.partial\(\)/.test(after) ? fields.map(makeOptional) : fields
  }

  // Other.extend({...}) / Other.partial() / Other.merge(...)
  const derived =
    /^([A-Za-z_$][\w$]*)\s*\.\s*(extend|partial|merge|pick|omit|strict|passthrough)\(/.exec(rest)
  if (derived) {
    const parent = schemaFields(derived[1]!, file, depth + 1) ?? []
    if (derived[2] === "partial") return parent.map(makeOptional)
    if (derived[2] === "extend") {
      const open = exprStart + rest.indexOf("{")
      const close = matchBracket(src, open)
      const extra =
        close === -1
          ? []
          : topLevelEntries(src.slice(open + 1, close)).map(([k, v]) => describeZod(k, v))
      const names = new Set(extra.map((f) => f.split(":")[0]!.replace(/\?$/, "")))
      return [...parent.filter((f) => !names.has(f.split(":")[0]!.replace(/\?$/, ""))), ...extra]
    }
    return parent
  }
  return null
}

function makeOptional(field: string): string {
  const [k, ...v] = field.split(":")
  return k!.endsWith("?") ? field : `${k}?:${v.join(":")}`
}

/** Body hint for one method's code segment. */
function bodyHint(segment: string, routeFile: string): string | null {
  // 1. Inline: (await req.json()) as { ... }
  const inline = /req\.json\(\)\s*\)?\s*as\s*\{/.exec(segment)
  if (inline) {
    const open = inline.index + inline[0].length - 1
    const close = matchBracket(segment, open)
    if (close !== -1) {
      const fields = topLevelEntries(segment.slice(open + 1, close)).map(
        ([k, v]) => `${k}: ${v.slice(0, 80)}`,
      )
      if (fields.length) return `{ ${fields.join(", ")} }`
    }
  }

  const imports = importsOf(read(routeFile), routeFile)

  // 2. A schema parsed right in the route.
  const direct = /(\w+[Ss]chema)\s*\.\s*(?:safeParse|parse|parseAsync|safeParseAsync)\(/.exec(
    segment,
  )
  if (direct) {
    const fields = schemaFields(direct[1]!, imports.get(direct[1]!) ?? routeFile)
    if (fields?.length) return `{ ${fields.join(", ")} }`
  }

  // 3. A service called with the body - follow it to the schema it validates with.
  const passed =
    /(\w+)\(\s*(?:[\w.]+\s*,\s*)*(?:await\s+)?req\.json\(\)/.exec(segment) ??
    (/const\s+body\s*=\s*await\s+req\.json\(\)/.test(segment)
      ? /(?:await\s+)?(\w+)\(\s*(?:[\w.]+\s*,\s*)*body\b/.exec(segment)
      : null)
  const fn = passed?.[1]
  const serviceFile = fn ? imports.get(fn) : undefined
  if (fn && serviceFile) {
    const src = read(serviceFile)
    const start = new RegExp(`export\\s+(?:async\\s+)?function\\s+${fn}\\b`).exec(src)
    if (start) {
      const next = src.indexOf("\nexport ", start.index + 10)
      const body = src.slice(start.index, next === -1 ? undefined : next)
      const schema = /(\w+[Ss]chema)\s*\.\s*(?:safeParse|parse|parseAsync|safeParseAsync)\(/.exec(
        body,
      )
      if (schema) {
        const fields = schemaFields(schema[1]!, serviceFile)
        if (fields?.length) return `{ ${fields.join(", ")} }`
      }
    }
  }
  return null
}

function permissionScopes(): Map<string, string> {
  const src = read(join(ROOT, "lib", "constants.ts"))
  const block = src.slice(src.indexOf("export const PERMISSIONS"), src.indexOf("} as const"))
  const map = new Map<string, string>()
  for (const m of block.matchAll(/(\w+):\s*"([\w:]+)"/g)) map.set(m[1]!, m[2]!)
  return map
}

interface MethodInfo {
  doc?: string
  query?: string[]
  body?: string
  permissions?: string[]
  guard?: string
  upload?: true
  /** Produces a downloadable file (or a signed link to one): use dnms_download. */
  file?: true
}

function analyse(file: string, scopes: Map<string, string>) {
  const src = read(file)
  const path = routePath(file)

  // Exported methods and where each one's code starts.
  const starts: Array<{ method: Method; index: number }> = []
  for (const m of src.matchAll(
    /export\s+(?:const|async\s+function|function)\s+(GET|POST|PUT|PATCH|DELETE)\b/g,
  )) {
    starts.push({ method: m[1] as Method, index: m.index! })
  }
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1]!.split(",")) {
      const alias = part
        .trim()
        .split(/\s+as\s+/)[1]
        ?.trim()
      if (alias && (HTTP_METHODS as readonly string[]).includes(alias)) {
        starts.push({ method: alias as Method, index: 0 })
      }
    }
  }
  if (starts.length === 0) return null
  starts.sort((a, b) => a.index - b.index)

  // Doc comments of the form "// GET /api/x ..." (plus continuation lines).
  const docs = new Map<Method, string>()
  // CRLF-safe: most files in this repo are checked out with \r\n, and a
  // trailing \r defeats the `(.*)$` below.
  const lines = src.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(/^\s*(?:\/\/|\*)\s*(GET|POST|PUT|PATCH|DELETE)\s+(\/api\/\S*)?(.*)$/)
    if (!m) continue
    const method = m[1] as Method
    if (docs.has(method)) continue
    // Drop the route's own path (it is already the entry's key) but keep any
    // "?a=&b=" query hint that follows it.
    const shown = (m[2] ?? "").startsWith(path) ? (m[2] ?? "").slice(path.length) : (m[2] ?? "")
    let text = `${shown}${m[3] ?? ""}`.replace(/^\s*[-:–]\s*/, "").trim()
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const cont = lines[j]!.match(/^\s*(?:\/\/|\*)\s+(?!(GET|POST|PUT|PATCH|DELETE)\s)(.+)$/)
      if (!cont || /^\s*(?:\/\/|\*)\s*$/.test(lines[j]!)) break
      text += " " + cont[2]!.trim()
    }
    docs.set(method, text.replace(/\s+/g, " ").slice(0, 400))
  }
  // Fallback: the file's leading comment.
  const lead = src.match(/^(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)\s*\n)+/)
  const leadText = lead?.[0]
    .replace(/\/\*+|\*+\/|^\s*\*\s?|\/\//gm, " ")
    .replace(/[=\-]{4,}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300)

  const methods: Partial<Record<Method, MethodInfo>> = {}
  starts.forEach((s, idx) => {
    if (exclusionReason(path, s.method)) return
    const end = s.index === 0 ? src.length : (starts[idx + 1]?.index ?? src.length)
    const segment = s.index === 0 ? src : src.slice(s.index, end)

    const query = Array.from(
      new Set(
        Array.from(
          segment.matchAll(
            /\b(?:searchParams|sp|qs|query|params|search)\s*\.\s*(?:get|getAll|has)\(\s*["'`]([\w.\-[\]]+)["'`]/g,
          ),
          (m) => m[1]!,
        ),
      ),
    )
    const perms = Array.from(
      new Set(
        Array.from(segment.matchAll(/PERMISSIONS\.(\w+)/g), (m) => scopes.get(m[1]!)).filter(
          (x): x is string => !!x,
        ),
      ),
    )
    const guard = segment.match(/=\s*(with\w+)\(/)?.[1]
    const info: MethodInfo = {}
    const doc = docs.get(s.method) ?? (Object.keys(methods).length === 0 ? leadText : undefined)
    if (doc) info.doc = doc
    if (query.length && s.method === "GET") info.query = query
    else if (query.length) info.query = query
    if (s.method !== "GET" && s.method !== "DELETE") {
      const body = bodyHint(segment, file)
      if (body) info.body = body.slice(0, 900)
    }
    if (/\.formData\(\)/.test(segment)) info.upload = true
    // A route that hands back a file: bytes with a download header or a document
    // MIME type, or (GET only) a signed storage link / redirect to one. POST
    // routes only count when they generate the bytes themselves, because a POST
    // that merely RETURNS a signed link is an upload.
    const makesFile =
      /Content-Disposition|content-disposition|application\/pdf|spreadsheetml|presentationml|wordprocessingml|text\/csv|octet-stream/.test(
        segment,
      )
    const linksToFile =
      s.method === "GET" &&
      /get\w*(Document|Resource)Url\(|NextResponse\.redirect\(\s*(url|fresh|signed|cached)|data:\s*\{[^}]*signedUrl/.test(
        segment,
      )
    // The brand page returns a data object that merely CONTAINS signed asset links.
    if (!info.upload && path !== "/api/projects/[id]/brand" && (makesFile || linksToFile))
      info.file = true
    if (perms.length) info.permissions = perms
    if (guard) info.guard = guard
    methods[s.method] = info
  })
  if (Object.keys(methods).length === 0) return null
  return { path, methods, load: importSpecifier(file) }
}

async function main() {
  const scopes = permissionScopes()
  const files = walk(API_DIR).sort()
  const entries = []
  let skipped = 0
  for (const file of files) {
    const path = routePath(file)
    if (exclusionReason(path)) {
      skipped++
      continue
    }
    const entry = analyse(file, scopes)
    if (entry) entries.push(entry)
  }

  const body = entries
    .map(
      (e) =>
        `  {\n    path: ${JSON.stringify(e.path)},\n    methods: ${JSON.stringify(e.methods)},\n    load: () => import(${JSON.stringify(e.load)}),\n  },`,
    )
    .join("\n")

  const out = `// AUTO-GENERATED by scripts/generate-mcp-api-map.ts - DO NOT EDIT BY HAND.
// Re-generate with \`pnpm mcp:api-map\` (also runs before dev and build).
// ${entries.length} routes included, ${skipped} excluded (see features/mcp/server/api-policy.ts).
import type { ApiRouteEntry } from "./api-catalog.types"

export const API_ROUTES: readonly ApiRouteEntry[] = [
${body}
]
`
  // Format exactly as the pre-commit hook would, and write only on a real
  // change. The raw output differs from the committed (Prettier-formatted)
  // file, so every dev/build used to leave it modified - which then blocked
  // `git pull` on the server.
  const formatted = await format(out, {
    ...(await resolveConfig(OUT)),
    filepath: OUT,
  })
  const label = `${entries.length} routes → ${relative(ROOT, OUT)} (${skipped} excluded)`
  if (existsSync(OUT) && readFileSync(OUT, "utf8") === formatted) {
    console.log(`[mcp:api-map] ${label}, unchanged`)
    return
  }
  writeFileSync(OUT, formatted)
  console.log(`[mcp:api-map] ${label}`)
}

main().catch((err) => {
  // Never block dev/build on the catalogue - the previous file stays in place.
  console.warn("[mcp:api-map] generation failed, keeping the existing catalogue:", err)
})
