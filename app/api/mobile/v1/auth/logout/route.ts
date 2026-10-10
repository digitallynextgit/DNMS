import { withErrorHandler } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { revoke } from "@/server/mobile-auth"
import { mobileLogoutSchema } from "@/features/auth/schemas/mobile-auth.schema"
import { bearerToken, ipThrottled, readJsonBody } from "@/features/auth/server/mobile-auth-http"

// -----------------------------------------------------------------------------
// POST /api/mobile/v1/auth/logout - sign this device out.
//
// ALWAYS 200, in the spirit of RFC 7009. revoke() never throws, an unknown token
// is a no-op, and a logout that 400s because the token was already dead is a
// worse answer than one that does nothing: the app clears its keychain
// regardless (auth.api.ts:96-105, "a user tapping sign out on a plane must still
// end up signed out"), so a failure status would only teach it to retry work
// that is already done - or, because this route is NOT called anonymously, send
// it round the refresh path first.
//
// NO ENUMERATION either: answering 404 for an unknown token and 200 for a known
// one would turn this into an oracle that says whether a token is live.
//
// Revoking kills the SESSION, not just the token presented, so the access token
// dies with the refresh token - and because resolveMobilePrincipal() re-reads the
// session row on every request, that takes effect on the very next call rather
// than at the end of the 15-minute access window. That is the whole reason the
// token is opaque.
// -----------------------------------------------------------------------------

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const POST = withErrorHandler(async (req) => {
  // Generous: a signed-in user has every right to sign out, one office is one IP,
  // and the only thing worth limiting here is someone grinding random tokens
  // through the hash lookup.
  const flooding = ipThrottled(req, "logout", 240, 5 * 60_000)
  if (flooding) return flooding

  const body = mobileLogoutSchema.parse(await readJsonBody(req))

  // The app posts {refreshToken} when it still holds one and NO BODY AT ALL when
  // it does not. In that second case the access token in the Authorization
  // header identifies the same session, and revoke() accepts either - so a
  // device whose refresh token was already spent can still sign itself out
  // properly instead of leaving a live row behind.
  const presented = body.refreshToken ?? bearerToken(req) ?? ""

  await revoke(presented)
  return ok({ revoked: true })
})
