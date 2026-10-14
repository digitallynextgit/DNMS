// The third thing the mobile dispatcher (app/api/mobile/v1/dnms/[...path]/route.ts) takes off the
// wire and hands to code it did not write: the request BODY. lib/mobile-dispatch-url.ts covers the
// other two - the target path and the origin.
//
// PURE AND FRAMEWORK-FREE FOR THE SAME REASON AS ITS SIBLING. The dispatcher imports
// server/mobile-auth.ts and server/api-handler.ts, both `import "server-only"`, so a test that
// imported the route would throw on its first import and never reach this decision. So this takes
// a content-type string and an ArrayBuffer and answers a question; nothing here touches Prisma,
// Next or a request object.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS. Measured over real HTTP:
//
//   POST /api/mobile/v1/dnms/leave/requests, body `not-json`
//     -> 500 {"success":false,"error":{"code":"INTERNAL_ERROR","message":"Something went wrong"}}
//     -> and one `[UNHANDLED] SyntaxError: Unexpected token 'o'` in the log, at ERROR level
//
// The throw comes from app/api/leave/requests/route.ts, which does `await req.json()` with nothing
// around it, and it is classified by THAT route's own withErrorHandler - the dispatcher's catch
// never sees it, which is why there is no accompanying `[mobile] route threw`. 204 of the route
// files under app/api read their body that way. It is pre-existing DNMS behaviour and a browser
// caller gets the identical 500.
//
// It is worse on a phone, which is why it is fixed here rather than filed. A truncated body is a
// REALISTIC event on a handset - the radio drops mid-upload, the OS suspends the app - and the
// result today is an alarming ERROR in the server log for something no server did wrong, plus
// "Something went wrong" on screen for something the client could have retried. The app also
// branches on STATUS: a 5xx means "nobody judged this request" and a 4xx means "this request was
// wrong" (src/lib/api-contract.ts), so answering 500 tells the app the opposite of the truth.
//
// FIXED AT THE DISPATCHER BOUNDARY, NOT IN THE HANDLERS. The dispatcher already buffers the body
// to a cap, so the bytes are in hand and the check is free; and the alternative - editing 204 route
// files, or widening normalize() in server/api-handler.ts so SyntaxError -> 400 for every route in
// the repo - changes the web app's behaviour too. The mobile surface is allowed to be stricter
// than the browser surface about what it forwards. The whole of DNMS is not this file's business.
//
// WHY NOT readJsonBody() (features/auth/server/mobile-auth-http.ts). It is the right tool for the
// five self-authenticating auth routes and the wrong one here, and the difference is instructive:
// it answers `{}` for a malformed body ON PURPOSE, so the zod schema behind it writes "Email is
// required" instead of the route answering 500. The dispatcher has no schema. It cannot tell `{}`
// from a caller who sent `{}`, and forwarding `{}` would hand a handler a body nobody sent - which
// is worse than the 500, because a write handler might act on it. Same goal, opposite tolerance:
// there, parse failure means "let zod explain"; here it means "refuse before anyone acts".
// ---------------------------------------------------------------------------

/**
 * A content-type that names a non-JSON body format this function must not judge.
 *
 * ONLY multipart, and the list is short deliberately. 15 route files under app/api read their body
 * with `req.formData()` - uploads: a profile photo, a document, a project file - and the dispatcher
 * forwards multipart with its original boundary intact precisely so those keep working (difference
 * 2 in the dispatcher's banner: uploads are NOT 415'd here, unlike the AI connector). A multipart
 * body is never valid JSON, so without this exemption every upload on the surface would 400.
 *
 * `multipart/`, not `multipart/form-data`: no multipart subtype is JSON, and a client that sends
 * `multipart/mixed` is still not sending something this check can read.
 *
 * NOT on the list, and this is the deliberate part: `application/x-www-form-urlencoded`. No DNMS
 * handler reads one (grepped: zero mentions under app/api) and the app sends exactly two kinds of
 * body - `JSON.stringify(body)` with `content-type: application/json`, or a FormData the runtime
 * types as multipart (src/lib/api-client.ts). It is also what `curl -d` picks by default, which is
 * how the 500 above was found. Refusing it is correct for this surface: the dispatcher's job is to
 * forward what its one client sends, not to be a general-purpose proxy.
 */
const NON_JSON_BODY = /^\s*multipart\//i

/**
 * True when these bytes will not survive `req.json()` inside a handler.
 *
 * THE GOVERNING RULE, and the one the test enforces sample by sample against a real `Request`:
 * THIS MAY NEVER REFUSE A BODY A HANDLER WOULD HAVE ACCEPTED. A gate that 400s a request the
 * handler could have served is a new bug traded for an old one, and it would land on exactly the
 * path the live smoke proved works (POST bodies and uploads). So:
 *
 *   - an ABSENT or EMPTY body is not malformed, it is absent. The dispatcher only assigns `body`
 *     when `byteLength > 0`, and several routes legitimately take no body at all (a DELETE, an
 *     approve, a logout) - `req.json()` is never called on it, or if it is, that is the handler's
 *     own pre-existing 500 and not something invented here.
 *   - MULTIPART is exempt - see NON_JSON_BODY.
 *   - the decode is the LENIENT one, which is what `Request.json()` itself does: UTF-8 decode
 *     (BOM stripped, invalid bytes to U+FFFD) and then JSON.parse. `fatal: true` would be the
 *     tighter choice and the wrong one - it would refuse a body carrying one stray byte inside a
 *     string that a handler parses happily today. Verified on Node 24 across valid objects,
 *     arrays, bare scalars, a BOM-prefixed object, truncated JSON, single-quoted JSON, whitespace,
 *     a lone 0xFF and a truncated multi-byte tail: this function and `Request.prototype.json()`
 *     agree on every one.
 *
 * The caller turns `true` into a 400; it is not this module's business what the envelope says.
 */
export function malformedJsonBody(
  contentType: string | null | undefined,
  body: ArrayBuffer | undefined,
): boolean {
  if (!body || body.byteLength === 0) return false
  if (NON_JSON_BODY.test(contentType ?? "")) return false
  try {
    JSON.parse(new TextDecoder().decode(body))
    return false
  } catch {
    return true
  }
}
