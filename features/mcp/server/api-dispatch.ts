import "server-only"

import { NextRequest } from "next/server"
import { MCP_SCOPES } from "../constants"
import { API_ROUTES } from "./api-routes.generated"
import type { ApiMethodInfo, HttpMethod } from "./api-catalog.types"
import { exclusionReason } from "./api-policy"
import { compilePatterns, matchPattern } from "../lib/route-match"
import { publicOrigin } from "./config"
import { runAsPrincipal, type Principal } from "./principal"

// =============================================================================
// The pass-through: run any DNMS API route AS the connected person.
//
// This is what makes the connector "everything": instead of re-implementing
// each module for the AI, the AI calls the same route handlers the DNMS web app
// calls, in-process, with the person's delegated session. Every check the route
// already has - withAuth, requirePermission, "is this your project", "is this
// your direct report" - applies unchanged, and so does audit logging.
//
// Route modules are imported lazily from the generated catalogue, so a call
// only loads the one route it needs.
// =============================================================================

type RouteHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> | Response

const COMPILED = compilePatterns(API_ROUTES, (e) => e.path)

function matchRoute(pathname: string) {
  const m = matchPattern(COMPILED, pathname)
  return m ? { entry: m.value, params: m.params } : null
}

export interface ApiCallInput {
  method: HttpMethod
  path: string
  query?: Record<string, unknown>
  body?: unknown
}

export interface ApiCallResult {
  ok: boolean
  status: number
  /** The route that handled it, e.g. "GET /api/projects/[id]/tasks". */
  route?: string
  data?: unknown
  text?: string
  note?: string
}

const WRITE_METHODS = new Set<HttpMethod>(["POST", "PUT", "PATCH", "DELETE"])

/** Responses bigger than this are trimmed (and the AI told how to narrow them). */
const MAX_CHARS = 90_000

/** A route that was run: the raw Response plus what we know about the route. */
export interface InvokedRoute {
  res: Response
  /** e.g. "GET /api/projects/[id]/tasks" */
  route: string
  /** The catalogue pattern, e.g. "/api/projects/[id]/tasks" */
  pattern: string
  info: ApiMethodInfo
}

/**
 * Run one DNMS API route in-process as the person - every policy gate here
 * (excluded routes, read-only connections, uploads) - and hand back the raw
 * Response. `callApi` reads it as data; the download tools read it as a file.
 */
export async function invokeRoute(
  principal: Principal,
  input: ApiCallInput,
): Promise<{ ok: true; value: InvokedRoute } | { ok: false; result: ApiCallResult }> {
  const fail = (result: ApiCallResult) => ({ ok: false as const, result })
  const method = input.method.toUpperCase() as HttpMethod
  const raw = input.path.trim()
  if (!raw.startsWith("/api/")) {
    return fail({ ok: false, status: 400, note: "path must start with /api/ - e.g. /api/leave/requests" })
  }

  // Accept "/api/x?a=1" as well as a separate `query` object.
  const url = new URL(raw, publicOrigin())
  const pathname = url.pathname.replace(/\/+$/, "") || "/"
  for (const [k, v] of Object.entries(input.query ?? {})) {
    if (v === undefined || v === null || v === "") continue
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, String(item)))
    else url.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v))
  }

  const match = matchRoute(pathname)
  if (!match) {
    return fail({
      ok: false,
      status: 404,
      note: `No DNMS endpoint matches ${pathname}. Use dnms_find_endpoints to look one up.`,
    })
  }
  const { entry, params } = match
  const routeLabel = `${method} ${entry.path}`

  const blocked = exclusionReason(entry.path, method)
  if (blocked) {
    return fail({
      ok: false,
      status: 403,
      route: routeLabel,
      note: `Not available through the AI connector: ${blocked}.`,
    })
  }
  const info: ApiMethodInfo | undefined = entry.methods[method]
  if (!info) {
    const allowed = Object.keys(entry.methods).join(", ")
    return fail({
      ok: false,
      status: 405,
      route: routeLabel,
      note: `${entry.path} supports: ${allowed || "nothing through the AI connector"}.`,
    })
  }
  if (WRITE_METHODS.has(method) && !principal.scopes.includes(MCP_SCOPES.WRITE)) {
    return fail({
      ok: false,
      status: 403,
      route: routeLabel,
      note: "This connection was granted read-only access. Reconnect DNMS and allow changes to do this.",
    })
  }
  if (info.upload) {
    return fail({
      ok: false,
      status: 415,
      route: routeLabel,
      note: "This endpoint takes a file upload, which the AI connector cannot send. Use the DNMS web app for this step.",
    })
  }

  const mod = (await entry.load()) as Record<string, unknown>
  const handler = mod[method] as RouteHandler | undefined
  if (typeof handler !== "function") {
    return fail({ ok: false, status: 405, route: routeLabel, note: `${method} is not implemented here.` })
  }

  const headers = new Headers({
    accept: "application/json",
    "user-agent": "DNMS-AI-Connector",
  })
  let body: string | undefined
  if (method !== "GET" && input.body !== undefined) {
    headers.set("content-type", "application/json")
    body = JSON.stringify(input.body)
  }
  const req = new NextRequest(url, { method, headers, body })

  try {
    const res = await runAsPrincipal(principal, async () =>
      handler(req, { params: Promise.resolve(params) }),
    )
    return { ok: true, value: { res, route: routeLabel, pattern: entry.path, info } }
  } catch (err) {
    console.error("[mcp] route threw", routeLabel, err)
    return fail({ ok: false, status: 500, route: routeLabel, note: "The DNMS endpoint failed unexpectedly." })
  }
}

export async function callApi(principal: Principal, input: ApiCallInput): Promise<ApiCallResult> {
  const run = await invokeRoute(principal, input)
  if (!run.ok) return run.result
  return readResponse(run.value.res, run.value.route, input.path)
}

async function readResponse(res: Response, route: string, path = ""): Promise<ApiCallResult> {
  const status = res.status
  const ok = status >= 200 && status < 300
  const type = res.headers.get("content-type") ?? ""

  if (status >= 300 && status < 400) {
    return {
      ok: false,
      status,
      route,
      note: `This endpoint redirects to a file. Use dnms_download with path ${path || "(this path)"} to get a download link.`,
    }
  }
  if (type.includes("application/json")) {
    const text = await res.text()
    let parsed: unknown
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      return { ok, status, route, text: text.slice(0, MAX_CHARS) }
    }
    const { value, trimmed } = fitToBudget(parsed)
    return {
      ok,
      status,
      route,
      data: value,
      ...(trimmed && {
        note: `Response trimmed to fit (${trimmed}). Narrow it with filters or page/limit query parameters.`,
      }),
    }
  }
  if (type.startsWith("text/")) {
    const text = await res.text()
    return {
      ok,
      status,
      route,
      text: text.slice(0, MAX_CHARS),
      ...(text.length > MAX_CHARS && { note: "Text truncated." }),
    }
  }
  // A file (PDF payslip, Excel export, image...). Not useful as text.
  await res.body?.cancel().catch(() => {})
  return {
    ok,
    status,
    route,
    note: `Returns a file (${type || "binary"}${res.headers.get("content-length") ? `, ${res.headers.get("content-length")} bytes` : ""}). Use dnms_download with path ${path || "(this path)"} to get a download link.`,
  }
}

/**
 * Keep a JSON payload under MAX_CHARS by halving its largest arrays. Returns a
 * human note describing what was cut, or null if nothing was.
 */
function fitToBudget(value: unknown): { value: unknown; trimmed: string | null } {
  let size = JSON.stringify(value)?.length ?? 0
  if (size <= MAX_CHARS) return { value, trimmed: null }

  const copy = structuredClone(value)
  const originalLength = new Map<string, number>()
  const shown = new Map<string, number>()
  for (let round = 0; round < 12 && size > MAX_CHARS; round++) {
    const target = largestArray(copy, "", 0)
    if (!target || target.arr.length <= 1) break
    const label = target.path || "root"
    if (!originalLength.has(label)) originalLength.set(label, target.arr.length)
    const keep = Math.max(1, Math.floor(target.arr.length / 2))
    target.arr.splice(keep)
    shown.set(label, keep)
    size = JSON.stringify(copy).length
  }
  if (size > MAX_CHARS) {
    return {
      value: { preview: JSON.stringify(copy).slice(0, MAX_CHARS) },
      trimmed: "too large even after trimming lists; showing the start only",
    }
  }
  const notes = Array.from(shown, ([label, keep]) => {
    return `${label}: showing ${keep} of ${originalLength.get(label)}`
  })
  return { value: copy, trimmed: notes.join("; ") }
}

interface ArrayRef {
  arr: unknown[]
  path: string
  size: number
}

/** The biggest array (by serialised size) within a few levels of `node`. */
function largestArray(node: unknown, path: string, depth: number): ArrayRef | null {
  if (depth > 4 || node === null || typeof node !== "object") return null
  if (Array.isArray(node)) return { arr: node, path, size: JSON.stringify(node).length }
  let best: ArrayRef | null = null
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    const found = largestArray(v, path ? `${path}.${k}` : k, depth + 1)
    if (found && (!best || found.size > best.size)) best = found
  }
  return best
}

// ---------------------------------------------------------------------------
// Catalogue search, for dnms_find_endpoints.
// ---------------------------------------------------------------------------

export interface EndpointSummary {
  path: string
  methods: Partial<Record<HttpMethod, ApiMethodInfo>>
}

const STOP = new Set(["the", "a", "an", "of", "for", "to", "in", "on", "my", "and", "or", "list", "get", "show"])

/** Score routes against free-text keywords; best matches first. */
export function findEndpoints(query: string, limit = 25): EndpointSummary[] {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
  if (words.length === 0) return []
  const scored = API_ROUTES.map((entry) => {
    const pathText = entry.path.toLowerCase()
    const docText = Object.values(entry.methods)
      .map((m) => `${m?.doc ?? ""} ${(m?.query ?? []).join(" ")} ${m?.body ?? ""}`)
      .join(" ")
      .toLowerCase()
    let score = 0
    for (const w of words) {
      const stem = w.replace(/(ies|es|s)$/, "")
      if (pathText.includes(stem)) score += 3
      if (docText.includes(stem)) score += 1
    }
    // Prefer shorter (collection-level) paths on ties.
    return { entry, score: score - entry.path.length / 1000 }
  })
    .filter((s) => s.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
  return scored.map(({ entry }) => ({ path: entry.path, methods: entry.methods }))
}

/** Every allowed endpoint as one compact line: "GET,POST /api/leave/requests". */
export function endpointIndex(): string[] {
  return API_ROUTES.map((e) => `${Object.keys(e.methods).join(",")} ${e.path}`)
}

export function describeEndpoint(path: string): EndpointSummary | null {
  const exact = API_ROUTES.find((e) => e.path === path)
  if (exact) return { path: exact.path, methods: exact.methods }
  const m = matchRoute(path.split("?")[0]!.replace(/\/+$/, ""))
  return m ? { path: m.entry.path, methods: m.entry.methods } : null
}
