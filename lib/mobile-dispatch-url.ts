// The two strings the mobile dispatcher (app/api/mobile/v1/dnms/[...path]/route.ts) builds out of
// attacker-controlled input and then hands to `new URL()`: the target PATH, which comes from the
// catch-all segments, and the ORIGIN, which comes from the Host headers.
//
// PURE AND FRAMEWORK-FREE SO THEY CAN BE UNIT-TESTED. The dispatcher imports server/mobile-auth.ts
// and server/api-handler.ts, both `import "server-only"`, so a test that imported the route would
// throw on its first import and never reach either function. Same reason, and the same shape, as
// lib/push-targets.ts - nothing here touches Prisma, Next or a request object.
//
// EVERY FUNCTION HERE REFUSES; NONE OF THEM REPAIRS. That is the rule the dispatcher's banner
// already argues for the path, and it generalises: the WHATWG URL parser treats several characters
// as structure rather than as text, so "strip the bad bits and carry on" means the string that was
// checked against the route catalogue and the string that is finally parsed are two different
// strings. Refusal is the only answer where those two cannot diverge.
//
// The behaviour quoted in the comments below was verified against Node 24's URL parser, not read
// off a spec; each line is a case in lib/mobile-dispatch-url.test.ts.

/**
 * Characters a path segment may not contain, because `new URL()` does not keep them inside the
 * segment. With `/api/employees/<seg>/photo` as the shape:
 *
 *   "abc\x"   -> /api/employees/abc/x/photo   an EXTRA SEGMENT. The parser reads a backslash as a
 *                                             separator, so one segment becomes two and the
 *                                             request reaches a pattern nobody matched.
 *   "abc?x=1" -> /api/employees/abc  ?x=1/photo   the path is TRUNCATED and the remainder becomes
 *                                             a query string the handler will read off
 *                                             searchParams.
 *   "abc#y"   -> /api/employees/abc  #y/photo    the same truncation, into a fragment.
 *   "a\tb"    -> /api/employees/ab/photo      tab, LF and CR are DELETED outright, so the path
 *                                             matched against the catalogue is not the path the
 *                                             handler is given.
 *
 * A space is NOT on this list and does not need to be: it percent-encodes to %20 and stays inside
 * its own segment. `/` is on it because a segment is never allowed to contain one.
 *
 * Next has already percent-DECODED these segments by the time a route handler sees them, which is
 * why the decoded characters are what this tests rather than their %XX forms. All six were fired
 * individually over real HTTP and the dispatcher answered 404 to each.
 *
 * "%2e%2e" is the one that does NOT arrive. Next decodes it and then NORMALISES the result away,
 * so a dot segment reaches neither this regex nor the two compares below - see dispatchPathname.
 */
const UNSAFE_IN_SEGMENT = /[\\/?#\t\n\r]/

/**
 * ["dashboard","me"] -> "/api/dashboard/me", or null for anything that is not a plain forward path.
 *
 * WHAT STOPS PATH TRAVERSAL IS NOT THIS FUNCTION. It is that
 * features/mcp/server/api-routes.generated.ts is an ALLOWLIST: the string built here is matched
 * against 308 literal patterns, and a path matching none of them is a flat 404 that loads no
 * module. Nothing downstream turns the path into a file path, a module specifier or a fetch, so
 * there is no "out of /api/" for a segment to climb to. That is the property the dispatcher's own
 * banner opens with ("THE CATALOGUE IS THE ALLOWLIST"), and it is the one to protect.
 *
 * THE "." AND ".." COMPARES BELOW ARE DEFENCE IN DEPTH FOR A DIRECT IN-PROCESS CALLER, AND NOTHING
 * MORE. An earlier version of this comment said they were what kept a "%2e%2e" segment from
 * climbing out of /api/. THAT WAS FALSE, and a false security comment is worse than no comment,
 * because the next reader stops checking the thing it claims is handled. Measured over real HTTP:
 * Next percent-decodes AND normalises dot segments before a route handler is entered, so
 * `segments` never contains "." or ".." however it was encoded.
 *
 *   /dnms/dashboard/%2E%2E/dashboard/me  arrives as ["dashboard","me"]  -> 200, real payload
 *   /dnms/x/%2E%2E/dashboard/me          arrives as ["dashboard","me"]  -> 200
 *   /dnms/employees/%2E%2E/photo         arrives as ["photo"]           -> 404 on "/api/photo"
 *   /dnms/employees/%2E/photo            arrives as ["employees","photo"] -> the REAL
 *                                        /api/employees/[id] handler with id="photo"
 *
 * The literal "../" form behaves identically, and `curl --path-as-is` rules the client out as the
 * normaliser. The collapse happens ABOVE this function; it is not performed by it.
 *
 * The compares stay anyway: this module is reachable without the framework in front of it - a unit
 * test, or any future caller that composes segments itself - and two string compares are not worth
 * removing to make a point. They are simply not load-bearing over HTTP, and nobody should plan as
 * though they were.
 *
 * THE INVARIANT THAT IS LOAD-BEARING: the path matched against the catalogue IS the path
 * dispatched. One string is built here, matched once, and handed to `new URL()` once. It survives
 * normalisation for free - the collapsed path is what reaches both the match and the dispatch - and
 * it is why the rest of the list refuses instead of repairing (see UNSAFE_IN_SEGMENT, where a
 * "repair" is exactly what would make those two strings diverge).
 */
export function dispatchPathname(segments: readonly string[]): string | null {
  if (segments.length === 0) return null
  for (const seg of segments) {
    if (!seg || seg === "." || seg === ".." || UNSAFE_IN_SEGMENT.test(seg)) return null
  }
  return `/api/${segments.join("/")}`
}

/**
 * host[:port], and nothing else. A registered name (letters, digits, dots, hyphens, underscores -
 * underscore is URL-legal even though DNS dislikes it), an IPv4 literal, or a bracketed IPv6
 * literal, optionally followed by one colon and up to five digits.
 *
 * 253 is the maximum length of a DNS name; 45 is a full IPv6 literal with an embedded IPv4 tail.
 */
const HOST_SHAPE = /^(?:\[[0-9A-Fa-f:.]{2,45}\]|[A-Za-z0-9._-]{1,253})(?::\d{1,5})?$/

/**
 * The trimmed Host value if it is safe to compose into an origin, else null.
 *
 * TWO CHECKS, because neither alone is enough and they refuse different things:
 *
 *   1. HOST_SHAPE rejects what the parser would happily ACCEPT as something other than a host.
 *      "user:pw@evil.test" keeps its userinfo, "ok.test/evil" silently drops the path, "ok.test?x=1"
 *      drops a query, "ok%2etest" and "evil.test\x" decode to a different host than the header
 *      said. None of these throw; all of them mean the origin is not what was validated.
 *   2. Composing it and letting the parser judge rejects what the shape cannot see. "1.2.3.4.5"
 *      THROWS, because the parser reads a trailing all-numeric label as a malformed IPv4 address;
 *      so do "[:::]", "]bad[", "a, b" (a multi-hop x-forwarded-host) and any port above 65535.
 *      A throw here is the whole finding: the dispatcher's `new URL(path, origin)` sits outside
 *      its try block, so an unparseable origin was an unhandled 500 with a stack.
 *
 * The probe uses http:// for both, which is sound because http and https are both "special"
 * schemes and the URL spec parses their hosts by the same rules.
 *
 * The value returned is the one that came in, NOT the parser's canonical form. Nothing survives
 * HOST_SHAPE that the parser would read as a different host - the only transformations left to it
 * are lower-casing and IPv4/IDNA canonicalisation - so there is nothing to gain by rewriting the
 * caller's string, and a function that both refuses and rewrites is harder to reason about.
 */
export function forwardableHost(raw: string | null | undefined): string | null {
  if (!raw) return null
  const host = raw.trim()
  if (!HOST_SHAPE.test(host)) return null
  try {
    new URL(`http://${host}/`)
    return host
  } catch {
    return null
  }
}

/**
 * "http" or "https" from an x-forwarded-proto value, else null. The first element, because each
 * proxy in a chain appends its own - the same rule nginx and every other hop apply to
 * x-forwarded-for.
 *
 * An allow-list rather than a pass-through because the scheme ends up in `new URL()` too, and this
 * one does NOT fail loudly: "javascript://x" parses perfectly well, and the result is a
 * javascript: base handed to any handler that builds an absolute URL from the request. (A scheme
 * with a space in it - "foo bar://x" - does throw, so both failure modes are live.)
 */
export function forwardedProto(raw: string | null | undefined): "http" | "https" | null {
  const first = raw?.split(",")[0]?.trim().toLowerCase()
  return first === "http" || first === "https" ? first : null
}
