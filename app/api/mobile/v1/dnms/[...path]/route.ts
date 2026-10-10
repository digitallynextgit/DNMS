import { NextRequest } from "next/server"
import { ipThrottled, throttled } from "@/features/auth/server/mobile-auth-http"
import { compilePatterns, matchPattern } from "@/features/mcp/lib/route-match"
import type { ApiMethodInfo, HttpMethod } from "@/features/mcp/server/api-catalog.types"
import { exclusionReason } from "@/features/mcp/server/api-policy"
import { API_ROUTES } from "@/features/mcp/server/api-routes.generated"
import { fail } from "@/lib/api-response"
import { resolveMobilePrincipal, runAsMobilePrincipal } from "@/server/mobile-auth"

// =============================================================================
// The mobile app's data surface.
//
//   GET /api/mobile/v1/dnms/dashboard/me  ->  the REAL /api/dashboard/me handler,
//                                             run in-process, as the person the
//                                             access token names.
//
// This is NOT a new API. It is the mechanism already in production for the AI
// connector (features/mcp/server/api-dispatch.ts:131-156): resolve the catalogue
// entry for the path, lazy-import that route module, and call its exported method
// with a synthetic NextRequest inside runWithTenant + runAsDelegate. Reusing it is
// the whole reason the mobile API is one file rather than a fork of 308 handlers:
//
//   - ZERO changes to any existing route handler. getSession()
//     (server/api-handler.ts:19-21) already reads delegatedSession() BEFORE auth(),
//     so a cookie-less caller is already a first-class caller. Every withAuth /
//     withSession permission check, every tenant filter and every audit log applies
//     to a phone exactly as it does to a browser, because it IS the same code.
//   - ONE line in proxy.ts ("/api/mobile" in PUBLIC_PREFIXES). Nothing here asks the
//     Edge to authenticate anything: the Edge has no database, and an opaque token
//     needs one. This route authenticates itself, exactly as /api/mcp does.
//
// ---------------------------------------------------------------------------
// THE CATALOGUE IS THE ALLOWLIST. READ THIS BEFORE CHANGING ANYTHING BELOW.
//
// The only modules this file can reach are the ones listed in
// features/mcp/server/api-routes.generated.ts, whose `load` functions are static
// `import("@/app/api/.../route")` literals written by
// scripts/generate-mcp-api-map.ts. Nothing here ever builds a module path, a file
// path or an import specifier out of the URL. That single property is what keeps
// this from being a proxy to anything on disk, and it is why an unknown path is a
// flat 404 instead of an attempt to load something.
//
// Two independent refusals, both kept on purpose:
//   1. not in the catalogue -> 404. The generator already drops every path
//      api-policy.ts excludes (/api/auth, /api/password, /api/portal, /api/settings,
//      /api/mobile, every /stream, ...), so those are simply not here.
//   2. exclusionReason(pattern, method) -> 403, carrying the policy's own reason. The
//      generated file is a BUILD ARTEFACT that can lag api-policy.ts, which is the
//      live policy; and BLOCKED_API_METHODS is method-level. So the policy is asked
//      again at request time. If someone ever deletes api-policy.ts:14, this check is
//      what still stops the dispatcher from dispatching to itself.
// Never widen either one. Adding a path here is adding a public endpoint.
// ---------------------------------------------------------------------------
//
// FIVE DELIBERATE DIFFERENCES FROM THE AI DISPATCHER. Each is a bug if copied back
// the other way, and a bug if "simplified" away here:
//
//   1. NO fitToBudget / MAX_CHARS = 90_000 TRIMMING (api-dispatch.ts:46,227-273).
//      That exists to fit an LLM's context window, and it works by halving the
//      largest array until the JSON fits. On a list screen that is silent data loss:
//      the attendance log would stop mid-month with the app none the wiser. A phone
//      renders what the web renders.
//   2. UPLOADS ARE NOT 415'd (api-dispatch.ts:122-129). The body is buffered and
//      forwarded with its original content-type - boundary and all - so multipart
//      survives and a profile photo or a document can be posted.
//   3. The response passes through UNTOUCHED: status, headers, body. 3xx, binary and
//      text all work, so the photo route's 302 to a presigned URL and a payslip
//      download behave as they do in a browser. The app unwraps the real DNMS
//      envelopes itself, so reshaping a payload here would break it.
//   4. The phone's own headers are forwarded (see FORWARDED_HEADERS), so a handler
//      that reads the request sees the device rather than this server.
//   5. The mustChangePassword fence is enforced here. The Edge enforces it for cookie
//      callers (proxy.ts:315-326) and cannot for this namespace, so the database does
//      it instead - which is what finally makes the app's existing "the server
//      enforces the password change" comment true.
//
// No OPTIONS / CORS handler, unlike app/api/mcp/route.ts: a native client sends no
// preflight, and answering one would hand this surface to any web page.
// =============================================================================

/** Prisma, AsyncLocalStorage and the real handlers. None of this can run on the Edge. */
export const runtime = "nodejs"

/** Every call is a per-request read of one person's data; nothing here is cacheable. */
export const dynamic = "force-dynamic"

/**
 * Some DNMS endpoints (exports, analytics, reports) are genuinely slow. 60s, not the
 * AI route's 120 (app/api/mcp/route.ts:12): a phone on mobile data has given up long
 * before then, and a request nobody is waiting for should not hold a worker.
 */
export const maxDuration = 60

/** Compiled once at module load; static segments beat dynamic ones (route-match.ts:1-2). */
const COMPILED = compilePatterns(API_ROUTES, (e) => e.path)

/**
 * The body is buffered, so it has to be capped. 25 MB clears a phone photo and a
 * scanned document with room to spare; each handler's own validation (file type, its
 * own size limit) still runs afterwards.
 */
const MAX_BODY_BYTES = 25 * 1024 * 1024

const WINDOW_MS = 60_000

/**
 * Per session, per minute. Generous on purpose: ten screens mount on a cold start and
 * useBadges() polls every 60s, so a budget tuned like the AI connector's (300 per
 * 5 min per grant) would throttle ordinary use. This caps a runaway retry loop; it is
 * not traffic shaping.
 *
 * Both budgets are PER PROCESS - lib/rate-limit.ts is an in-memory Map - so behind a
 * PM2 cluster the real ceiling is this times the instance count. Redis if that ever
 * matters, which is what lib/rate-limit.ts:1-2 already says.
 */
const PER_SESSION_PER_MIN = 240

/**
 * Pre-auth, per IP: the only thing between an anonymous flood and one database token
 * lookup per request. Deliberately high, because a whole office behind one NAT shares
 * an IP - and because if nginx sends neither x-real-ip nor x-forwarded-for then
 * clientIp() returns "unknown" for everybody and they all share THIS one bucket
 * (lib/rate-limit.ts:25-31).
 */
const PER_IP_PER_MIN = 600

/**
 * Headers copied from the phone's request onto the synthetic one.
 *
 * An allowlist, not a filter, because of what must NOT cross:
 *   - `authorization` carries a live mobile access token. No DNMS handler has any use
 *     for it, and a handler that logged its headers or forwarded them upstream would
 *     leak a working credential. It stops here.
 *   - `cookie`: a native client sends none, but a forged one must never reach a
 *     handler. (runAsDelegate wins inside getSession() regardless - belt and braces.)
 *   - `x-tenant-slug` / `x-tenant-id` are client-forgeable. proxy.ts:211-214 strips
 *     them from EVERY inbound request and only the verified session re-adds them; here
 *     the tenant comes from the token, via runAsMobilePrincipal.
 *   - `host` is carried by the URL instead.
 *
 * Note getAuditMeta() (server/action-guard.ts:36-42) reads next/headers - the REAL
 * inbound request - so audit rows already record the phone's IP and user-agent without
 * any help from this list. The forwarding here is for handlers that read `req` directly.
 */
const FORWARDED_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  // So clientIp(req) inside a handler keys the handset, not this server.
  "x-real-ip",
  "x-forwarded-for",
  // The device, for handlers that record it themselves.
  "user-agent",
  // A byte-range request must not silently come back as the whole file.
  "range",
] as const

type RouteHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> | Response

type DispatcherContext = { params: Promise<{ path?: string[] }> }

/**
 * The origin the phone actually reached, honouring nginx's x-forwarded-* - the same
 * rule, and the same reason, as proxy.ts's onThisOrigin() (proxy.ts:196-209).
 *
 * NOT features/mcp/server/config.ts publicOrigin(): APP_PUBLIC_ORIGIN is unset in
 * production and NEXTAUTH_URL there is "http://localhost:3000", so any handler that
 * builds an absolute URL out of the request would hand the phone a loopback address.
 */
function originOf(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  if (!host) return new URL(req.url).origin
  const forwarded = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const proto = forwarded || (new URL(req.url).protocol === "https:" ? "https" : "http")
  return `${proto}://${host}`
}

/**
 * ["dashboard","me"] -> "/api/dashboard/me". Returns null for anything that is not a
 * plain forward path: "." and ".." are refused outright rather than normalised, so no
 * %2e%2e segment can climb out of /api/ and land on a pattern nobody meant to expose.
 */
function targetPathname(segments: string[]): string | null {
  if (segments.length === 0) return null
  for (const seg of segments) {
    if (!seg || seg === "." || seg === ".." || seg.includes("/")) return null
  }
  return `/api/${segments.join("/")}`
}

async function dispatch(
  req: NextRequest,
  ctx: DispatcherContext,
  method: HttpMethod,
): Promise<Response> {
  // Cheapest gate first: in-memory, and it runs before the token lookup, so an
  // anonymous flood costs no database work. Both limits use the shared throttle so
  // every mobile route answers 429 the same way, with the same Retry-After the app
  // is written to honour (features/auth/server/mobile-auth-http.ts).
  const flooding = ipThrottled(req, "dispatch", PER_IP_PER_MIN, WINDOW_MS)
  if (flooding) return flooding

  // The first real act of this route, before the path is even looked at: no principal,
  // no dispatch. Every revocation (signed out, offboarded, tenant suspended, password
  // changed, permissions edited) lands here on the very next call, because
  // resolveMobilePrincipal re-reads the membership and the permission set every time
  // and caches nothing. See the banner in server/mobile-auth.ts.
  const principal = await resolveMobilePrincipal(req)
  if (!principal) {
    return fail("UNAUTHORIZED", "A valid DNMS mobile access token is required", 401)
  }

  // The mobile twin of the Edge fence at proxy.ts:315-326. POST /api/mobile/v1/password
  // is a sibling route, not a dispatched one, so the way out stays open - and
  // /api/password is excluded from the catalogue anyway (api-policy.ts:15).
  if (principal.mustChangePassword) {
    return fail("PASSWORD_CHANGE_REQUIRED", "Change your DNMS password before using the app", 403)
  }

  // Keyed on the SESSION, not the token: the token rotates every 15 minutes, so a
  // token-keyed bucket would reset itself and limit nothing over a long run.
  const busy = throttled(
    `mobile:dispatch:session:${principal.sessionId}`,
    PER_SESSION_PER_MIN,
    WINDOW_MS,
  )
  if (busy) return busy

  const { path } = await ctx.params
  const pathname = targetPathname(path ?? [])
  if (!pathname) return fail("NOT_FOUND", "No DNMS endpoint was named", 404)

  const match = matchPattern(COMPILED, pathname)
  if (!match) {
    return fail("NOT_FOUND", `No DNMS endpoint matches ${pathname.slice(0, 200)}`, 404)
  }
  const entry = match.value
  const routeLabel = `${method} ${entry.path}`

  // Ask the LIVE policy again - see "THE CATALOGUE IS THE ALLOWLIST" above.
  const blocked = exclusionReason(entry.path, method)
  if (blocked) {
    return fail("FORBIDDEN", `Not available to the mobile app: ${blocked}`, 403)
  }

  const info: ApiMethodInfo | undefined = entry.methods[method]
  if (!info) {
    const allowed = Object.keys(entry.methods).join(", ")
    return fail("METHOD_NOT_ALLOWED", `${entry.path} supports: ${allowed || "no methods"}`, 405)
  }

  // The query string, verbatim: filters, page, limit, download=1 and everything else
  // the handlers read off searchParams.
  const url = new URL(pathname + req.nextUrl.search, originOf(req))

  const headers = new Headers()
  for (const name of FORWARDED_HEADERS) {
    const value = req.headers.get(name)
    if (value) headers.set(name, value)
  }
  if (!headers.has("accept")) headers.set("accept", "application/json")

  // Buffered rather than streamed: a handler may call req.json() and then req.formData(),
  // and a one-shot stream would make the second call throw. content-length is only a
  // claim, so the buffered length is checked too.
  let body: ArrayBuffer | undefined
  if (method !== "GET") {
    const declared = Number(req.headers.get("content-length") ?? 0)
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return fail("PAYLOAD_TOO_LARGE", "That upload is too large", 413)
    }
    try {
      const buffered = await req.arrayBuffer()
      if (buffered.byteLength > MAX_BODY_BYTES) {
        return fail("PAYLOAD_TOO_LARGE", "That upload is too large", 413)
      }
      if (buffered.byteLength > 0) body = buffered
    } catch {
      return fail("BAD_REQUEST", "The request body could not be read", 400)
    }
  }

  const mod = (await entry.load()) as Record<string, unknown>
  const handler = mod[method] as RouteHandler | undefined
  // The catalogue is generated by reading the source, so a renamed or removed export
  // surfaces as a 405 here rather than as a crash.
  if (typeof handler !== "function") {
    return fail("METHOD_NOT_ALLOWED", `${method} is not implemented on ${entry.path}`, 405)
  }

  const inner = new NextRequest(url, { method, headers, body })

  try {
    // runWithTenant + runAsDelegate, the strong form - server/mobile-auth.ts:592-599.
    //
    // The handler's Response is returned untouched. One honest caveat: a route that
    // returned a LAZY stream would produce its bytes after this callback resolves, i.e.
    // outside the tenant and delegate contexts. Every /stream path is excluded from the
    // catalogue (api-policy.ts:18), which is what keeps that theoretical. Do not relax
    // that exclusion without solving it first.
    return await runAsMobilePrincipal(principal, async () =>
      handler(inner, { params: Promise.resolve(match.params) }),
    )
  } catch (err) {
    // The route's own wrapper (withAuth / withSession / withErrorHandler) funnels its
    // errors, so anything arriving here escaped one. Log it server-side; tell the phone
    // nothing it could not already guess - never a stack, never a message we did not write.
    console.error("[mobile] route threw", routeLabel, err)
    return fail("INTERNAL_ERROR", "Something went wrong", 500)
  }
}

export const GET = (req: NextRequest, ctx: DispatcherContext) => dispatch(req, ctx, "GET")
export const POST = (req: NextRequest, ctx: DispatcherContext) => dispatch(req, ctx, "POST")
export const PATCH = (req: NextRequest, ctx: DispatcherContext) => dispatch(req, ctx, "PATCH")
export const PUT = (req: NextRequest, ctx: DispatcherContext) => dispatch(req, ctx, "PUT")
export const DELETE = (req: NextRequest, ctx: DispatcherContext) => dispatch(req, ctx, "DELETE")
