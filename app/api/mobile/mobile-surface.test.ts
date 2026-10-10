import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { exclusionReason } from "@/features/mcp/server/api-policy"

// =============================================================================
// The ledger of /api/mobile.
//
// proxy.ts lists "/api/mobile" in PUBLIC_PREFIXES, so the Edge waves every path
// under it through with NO session check. That is deliberate and unavoidable -
// an opaque Bearer token can only be verified where there is a database, and the
// Edge is not that place - but it makes this one directory the only place in
// DNMS where forgetting a line of code publishes company data to the internet.
// A route here that never resolves a principal is not "missing a guard": it is
// a public endpoint, and nothing else in the build will say so.
//
// This file is what says so. It reads the directory and refuses any file not
// written down in SURFACE below alongside what that file verifies. Adding to the
// mobile surface is therefore a deliberate two-file change: the route, and a
// line here that a reviewer has to read.
//
// It is a TEXT test on purpose. It imports no route and runs no handler, so it
// needs no database, no NextRequest and no mocks - this suite covers pure
// modules only (vitest.config.ts). The cost is that it proves a route MENTIONS
// its guard, not that the guard runs. That is the right trade: the mistake it
// catches is the realistic one - a new route copied from a neighbour with the
// token check dropped on the way - and a real request test against a real
// Prisma client is a kind of test this repo has none of to copy from.
// =============================================================================

const ROOT = path.join(process.cwd(), "app", "api", "mobile")

/** This file. Next routes only page/layout/route; colocated tests are ignored. */
const SELF = "mobile-surface.test.ts"

type RouteGuard = {
  /**
   * Set ONLY on a route that must answer WITHOUT an access token, naming the
   * credential it proves instead. Absent means "this route resolves a
   * principal", and the self-check below holds the table to that.
   */
  open?: string
  /**
   * Symbols the file must actually CALL. Checked against the source with
   * comments stripped, so a route can never satisfy its own guard in prose.
   */
  requires: readonly string[]
}

/**
 * Every file /api/mobile is allowed to contain.
 *
 * Paths are relative to app/api/mobile and are the app's wire contract: each one
 * is called by literal string from the Expo client (dnmsApp src/lib/api-contract.ts
 * lists the same set), so this table is also the completeness check on the surface.
 */
const SURFACE: Readonly<Record<string, RouteGuard>> = {
  // --- Minting a session: no access token exists yet, by definition. ---------

  /** authorizeWithIdentity brings its own 10/email + 30/IP per-15-min throttle. */
  "v1/auth/login/route.ts": {
    open: "email + password",
    requires: ["authorizeWithIdentity", "issueSession"],
  },

  /** The id_token's aud must match a configured client id and email_verified must
   *  be true; it must NEVER self-register (server/auth.ts:211-234 is a staff door). */
  "v1/auth/google/route.ts": {
    open: "a Google id_token",
    requires: ["issueSession"],
  },

  /** A six-digit code minted by a browser that already holds a live web session.
   *  redeemPairCode() is the guard, not issueSession(): it is what reads, judges and
   *  BURNS the code. Both are named, so dropping either is a failure here. */
  "v1/auth/pair/route.ts": {
    open: "a single-use pairing code",
    requires: ["redeemPairCode", "issueSession"],
  },

  /** THE ODD ONE OUT, and the reason this table is worth the trouble. Every other
   *  file here answers for a mobile token or a token-shaped credential; this one
   *  mints a pairing code for a browser, so the credential it checks is the
   *  ORDINARY WEB SESSION. The Edge cannot check it for us - /api/mobile is a
   *  PUBLIC_PREFIX - so the route calls the house staff guard itself, and
   *  withSession() is getSession() + "no session is a 401" + assertStaff()
   *  (server/api-handler.ts). Without that line this is an anonymous POST that
   *  hands out 30-day mobile sessions. */
  "v1/auth/pair/start/route.ts": {
    open: "a live DNMS web session (cookie), not a mobile token",
    requires: ["withSession", "mintPairCode"],
  },

  /** rotate() is the whole guard: it reads, judges and burns the refresh token. */
  "v1/auth/refresh/route.ts": {
    open: "the refresh token itself",
    requires: ["rotate"],
  },

  /** RFC 7009: a logout that 400s because the token was already dead is a worse
   *  answer than one that does nothing, so revoke() never throws. */
  "v1/auth/logout/route.ts": {
    open: "either token of the session it ends",
    requires: ["revoke"],
  },

  // --- Holding a session: every one of these resolves the Bearer itself. -----

  /** Not reachable through the dispatcher - api-policy.ts excludes /api/password
   *  from the catalog entirely - and it must answer with a fresh pair. See the
   *  ordering test at the bottom of this file for why. */
  "v1/password/route.ts": {
    requires: ["resolveMobilePrincipal", "setOwnPassword", "revokeAllForUser", "issueSession"],
  },

  /** FCM/APNs device tokens. /api/notifications/push cannot serve these: a device
   *  token is not an https push URL and carries no VAPID keys. */
  "v1/devices/route.ts": {
    requires: ["resolveMobilePrincipal"],
  },

  /** Reads grants fresh from the DB rather than from a token's frozen claims. */
  "v1/me/route.ts": {
    requires: ["resolveMobilePrincipal", "mobileUserFrom"],
  },

  /** One aggregate count instead of the web's four polls and two SSE streams. */
  "v1/badges/route.ts": {
    requires: ["resolveMobilePrincipal"],
  },

  /** The catch-all that runs the real /api/<rest> handler in-process. This is the
   *  file that reaches all 308 existing routes, so it is the one where a dropped
   *  token check would hand over the entire platform. */
  "v1/dnms/[...path]/route.ts": {
    requires: ["resolveMobilePrincipal", "runAsMobilePrincipal"],
  },
}

// -----------------------------------------------------------------------------
// Reading the tree
// -----------------------------------------------------------------------------

/** Every file under app/api/mobile, as posix paths relative to it. Sorted, so a
 *  failure prints the same list every run. Empty directories are invisible,
 *  which is correct: a directory with no route in it serves nothing. */
function walk(dir: string, prefix = ""): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel))
    else out.push(rel)
  }
  return out.sort()
}

/**
 * Source with comments removed, so `requires` means "calls it" and not "talks
 * about it" - these route files are heavily commented and will name their own
 * guard in prose. The `[^:]` guard keeps "https://" from being read as the start
 * of a line comment; anything else it mis-strips can only cause a FALSE FAILURE,
 * never a false pass, which is the direction to be wrong in here.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/gm, "$1")
}

function sourceOf(file: string): string | null {
  const full = path.join(ROOT, ...file.split("/"))
  return fs.existsSync(full) ? stripComments(fs.readFileSync(full, "utf8")) : null
}

/**
 * Does the source CALL `symbol`? The trailing `\s*\(` is what makes this a call
 * rather than a mention, and the leading `\b` is load-bearing in the other
 * direction: without it `revoke` would be satisfied by `revokeAllForUser`, and
 * the logout route would pass this test while revoking nothing.
 */
function calls(source: string, symbol: string): boolean {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`\\b${escaped}\\s*\\(`).test(source)
}

const declared = Object.keys(SURFACE)
const onDisk = walk(ROOT).filter((file) => file !== SELF)

// -----------------------------------------------------------------------------

describe("the /api/mobile surface", () => {
  it("is still a public prefix in proxy.ts - the premise of everything below", () => {
    const proxy = fs.readFileSync(path.join(process.cwd(), "proxy.ts"), "utf8")
    const list = /const PUBLIC_PREFIXES = \[([\s\S]*?)\n\]/.exec(proxy)
    expect(list, "PUBLIC_PREFIXES moved in proxy.ts - re-point this check").not.toBeNull()
    expect(list?.[1], "/api/mobile is no longer public: this whole file may be obsolete").toContain(
      '"/api/mobile"',
    )
  })

  it("contains exactly the files written down in SURFACE", () => {
    const want = new Set(declared)
    const have = new Set(onDisk)

    // The dangerous direction. The Edge waves this prefix through, so an
    // undeclared file here is reachable by anyone on the internet from the
    // moment it ships until somebody happens to notice.
    expect(
      onDisk.filter((file) => !want.has(file)),
      "undeclared file(s) under a PUBLIC prefix: add each to SURFACE with the guard it " +
        "resolves, or delete it. Do not loosen this test to make them pass.",
    ).toEqual([])

    // The other direction is not a hole, it is a dead app: every path in SURFACE
    // is one the Expo client calls by literal string.
    expect(
      declared.filter((file) => !have.has(file)),
      "declared in SURFACE but missing from disk - the app calls these paths",
    ).toEqual([])
  })

  it("lets no entry claim a guard it does not name", () => {
    for (const [file, guard] of Object.entries(SURFACE)) {
      expect(guard.requires.length, `${file} declares no required symbol`).toBeGreaterThan(0)
      // "Intentionally public" is only allowed to mean "proves something else",
      // which `open` has to spell out. Everything else resolves the Bearer.
      if (!guard.open) {
        expect(guard.requires, `${file} is not open, so it must resolve a principal`).toContain(
          "resolveMobilePrincipal",
        )
      }
    }
  })

  it.each(declared)("%s authenticates its own caller", (file) => {
    const source = sourceOf(file)
    expect(source, `${file} is not on disk - see the exact-set test above`).not.toBeNull()
    for (const symbol of SURFACE[file].requires) {
      expect(
        calls(source ?? "", symbol),
        `${file} never calls ${symbol}(). ${SURFACE[file].open ?? "An access token"} is what ` +
          "this route is written down as verifying; if that changed, change SURFACE too.",
      ).toBe(true)
    }
  })

  it("renders no page under a prefix the Edge waves through", () => {
    // A page.tsx here would be served to anyone, with no session and no proxy
    // redirect to /login, because isPublic() matched before any of that ran.
    const rendered = onDisk.filter((file) =>
      /(^|\/)(page|layout|template|default)\.[jt]sx?$/.test(file),
    )
    expect(rendered, "/api/mobile is public: a page here renders signed-out").toEqual([])
  })

  it("never opts a mobile route into the Edge runtime", () => {
    // Prisma, bcrypt and sha256Hex all need Node. An `export const runtime =
    // "edge"` here compiles clean and then fails the first real request.
    for (const file of declared) {
      expect(sourceOf(file) ?? "", file).not.toMatch(/runtime\s*=\s*["']edge["']/)
    }
  })

  it("keeps the whole surface out of the AI connector catalog", () => {
    // scripts/generate-mcp-api-map.ts runs before BOTH dev and build, so a new
    // route is offered to Claude and ChatGPT the moment it ships unless
    // api-policy.ts excludes it. The app's own namespace must never be offered:
    // these routes take a mobile Bearer, not an OAuth grant.
    for (const file of declared) {
      const pattern = `/api/mobile/${file.replace(/\/route\.ts$/, "")}`
      expect(exclusionReason(pattern), `${pattern} is visible to the AI connector`).not.toBeNull()
    }
  })

  it("changes a password in the one order that cannot lock the user out", () => {
    const source = sourceOf("v1/password/route.ts")
    expect(source, "v1/password/route.ts is not on disk").not.toBeNull()
    const at = (symbol: string) => (source ?? "").indexOf(`${symbol}(`)

    // setOwnPassword() writes users.passwordChangedAt, whose own comment reads
    // "passwordChangedAt revokes every session issued before this write"
    // (server/identity.ts:202-203). So the call that changes the password kills
    // the session that made it, and only this order survives:
    //   setOwnPassword -> revokeAllForUser -> issueSession
    // Issue first and the new pair predates passwordChangedAt and dies on its
    // next request; skip the revoke and the lost phone keeps its session.
    // Source order is a proxy for execution order, not a proof - but it catches
    // the way this actually gets written wrong.
    expect(at("setOwnPassword"), "must call setOwnPassword()").toBeGreaterThan(-1)
    expect(at("revokeAllForUser"), "revoke every device AFTER the write").toBeGreaterThan(
      at("setOwnPassword"),
    )
    expect(at("issueSession"), "issue the new pair LAST, or it is revoked too").toBeGreaterThan(
      at("revokeAllForUser"),
    )
  })
})

// =============================================================================
// What these routes are allowed to put in a log.
//
// A different mistake from the one above: not a missing guard, but a credential
// written to disk by a line that reads as harmless diagnostics. Both of the
// cases below were live bugs on this branch - one of them in a route whose own
// banner claimed the opposite - and neither is visible in a diff unless you
// already know what the dependency puts in its error messages.
// =============================================================================

/**
 * Every console call's ARGUMENT TEXT, found by counting parentheses rather than
 * with a regex. These log lines are template literals containing `(` and `)` of
 * their own, so a non-greedy `\\(([\\s\\S]*?)\\)` stops at the first inner
 * bracket and silently checks half an argument list - which would make the
 * assertions below pass for the wrong reason.
 */
function logCalls(source: string): string[] {
  const out: string[] = []
  const re = /console\.\w+\(/g
  let hit: RegExpExecArray | null
  while ((hit = re.exec(source))) {
    const start = hit.index + hit[0].length
    let depth = 1
    let i = start
    while (i < source.length && depth > 0) {
      if (source[i] === "(") depth += 1
      else if (source[i] === ")") depth -= 1
      i += 1
    }
    out.push(source.slice(start, i - 1))
  }
  return out
}

describe("the mobile routes log no credential", () => {
  it("the google route never echoes the verifier's own error message", () => {
    const source = sourceOf("v1/auth/google/route.ts") ?? ""
    const logged = logCalls(source)

    // THE BUG THIS EXISTS FOR: google-auth-library builds its failure messages
    // out of the material it was handed. build/src/auth/oauth2client.js:692
    // throws `"Wrong number of segments in token: " + jwt` - the RAW id_token
    // inside an Error - and the envelope branches (:703, :708, :724) interpolate
    // its segments. `console.warn(..., err.message)` therefore writes a live
    // Google credential into the production log, where it is replayable until it
    // expires by anyone who can read logs. The route logs the error CLASS only.
    expect(logged.length, "the google route stopped logging - re-point this check").toBeGreaterThan(
      0,
    )
    for (const args of logged) {
      expect(args, "a verifier error message in a log line IS a logged id_token").not.toMatch(
        /\berr(or)?\s*\??\.\s*message\b/,
      )
      // `console.warn("...:", err)` prints the message too, through the inspector.
      expect(args, "logging the error object prints its message").not.toMatch(/\berr\b\s*,?\s*$/)
      // And the obvious one, which no version of this route has done.
      expect(args, "the id_token itself must never reach a log").not.toMatch(/idToken|\bjwt\b/)
    }
  })

  it("the devices route records a cross-employee repoint, by id and never by token", () => {
    const source = sourceOf("v1/devices/route.ts") ?? ""

    // The upsert keys on the GLOBALLY unique raw token and rewrites both
    // tenantId and employeeId to the caller's, so whoever presents a known token
    // takes the row over - across companies. That move is required and stays: a
    // handset changes hands, and FCM/APNs hand the same registration token back
    // to a reinstalled app, so refusing it would keep delivering one employee's
    // notifications to another's phone. The guard is that it is OBSERVABLE,
    // because "why did X receive Y's notification?" is otherwise unanswerable -
    // the row has already been overwritten and nothing else remembers who held it.
    expect(source, "the previous holder has to be read for the change to be noticed").toMatch(
      /deviceToken\.findUnique/,
    )
    expect(source, "employeeId is the field whose change matters").toMatch(/employeeId\s*!==/)

    const logged = logCalls(source)
    expect(logged.length, "a repoint must leave a record").toBeGreaterThan(0)
    for (const args of logged) {
      // The device token is a push credential - holding it is enough to address
      // the handset - so it must never be written down, which is the same reason
      // this route answers with a bare acknowledgement. The VALUE, not the word:
      // the log line is allowed to say "push token re-pointed".
      expect(args, "a device token in a log line is a push credential on disk").not.toMatch(
        /body\.token|\$\{[^}]*\btoken\b[^}]*\}/,
      )
      expect(args, "a repoint is only answerable if it names both employees").toMatch(/employee/i)
    }
  })
})
