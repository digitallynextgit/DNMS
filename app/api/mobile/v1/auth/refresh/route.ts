import { withErrorHandler } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { rotate } from "@/server/mobile-auth"
import { mobileRefreshSchema } from "@/features/auth/schemas/mobile-auth.schema"
import {
  ipThrottled,
  issuedBody,
  mobileAuthFailure,
  readJsonBody,
  throttled,
  tokenKey,
} from "@/features/auth/server/mobile-auth-http"

// -----------------------------------------------------------------------------
// POST /api/mobile/v1/auth/refresh - trade a refresh token for a new pair.
//
// A thin wrapper over rotate() (server/mobile-auth.ts), which owns the whole
// decision: the atomic `updateMany({where:{id, usedAt:null}})` claim, the
// re-applied membership liveness checks, and the three-tier reuse response.
//
// THE CODES ARE THE CONTRACT. The app branches on them and gets a DIFFERENT
// sentence and a different teardown for each (REFRESH_FAILURE_REASONS,
// dnmsApp/src/lib/api-contract.ts:205-222):
//   INVALID_REFRESH  401  unknown token, OR a reuse INSIDE the 60s race window.
//                         The chain SURVIVES this one - ten screens mounting on a
//                         cold start all present the same stored token, and
//                         treating that as theft would sign the user out every
//                         time they opened the app. The app reads it as "expired".
//   SESSION_REVOKED  401  signed out, replaced, offboarded, password changed, or
//                         a reuse AFTER the race window, which rotate() treats as
//                         theft and kills the whole chain for.
//   SESSION_EXPIRED  401  the 30 days ran out.
// All three are emitted verbatim by mobileAuthFailure(); do not re-map or
// generalise them.
//
// ONE KNOWN DISAGREEMENT, recorded here so it is not "fixed" in the wrong place.
// rotate() keeps the chain ALIVE for a reuse inside its 60s race window and says
// INVALID_REFRESH, but the app reads any coded 401 - INVALID_REFRESH included -
// as terminal and signs out. So the server's forgiveness is currently
// unclaimable. The fix is one retry on the app side, NOT a different code here
// and NOT re-issuing on a spent token: re-issuing would delete the whole point
// of rotation, which is that a token presented twice is evidence.
//
// AND THE STATUS IS HALF THE CONTRACT. classifyRefreshFailure() treats ONLY a
// CODED 401 as a verdict on the token; anything else - a 422 from zod, the 429
// below, a 500 - is "nobody judged this token", so the app KEEPS the pair and
// fails just that one request. That is why mobileAuthFailure() rethrows what it
// does not recognise instead of flattening it to 401: a coded 401 earned by a
// dropped database connection would destroy a live 30-day credential.
// -----------------------------------------------------------------------------

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const POST = withErrorHandler(async (req) => {
  // DELIBERATELY LOOSE, and the looseness is the point. One office is one IP, and
  // every phone on that Wi-Fi refreshes roughly every 15 minutes - so a figure
  // sized for one person would 429 a whole company every morning. A refresh token
  // is 32 random bytes; there is no guessing attack for a per-IP cap to stop. The
  // per-token cap below is the one with teeth, and it is keyed on exactly the
  // thing a stampede repeats.
  const flooding = ipThrottled(req, "refresh", 600, 5 * 60_000)
  if (flooding) return flooding

  const body = mobileRefreshSchema.parse(await readJsonBody(req))

  // PER TOKEN, which is the stampede this route actually has: the token rotates
  // on every success, so repeated hits on the SAME token are by definition
  // retries - ten screens waking at once, or a client with no single-flight.
  // 15 per 5 minutes is the figure the app already codes to, and its cooldown is
  // keyed on the same token, so the two agree without negotiating.
  const retrying = throttled(tokenKey("refresh", body.refreshToken), 15, 5 * 60_000)
  if (retrying) return retrying

  try {
    const issued = await rotate(body.refreshToken)
    // The user and tenant blocks ride along even though the app's RefreshResponse
    // reads only the three token fields: a refresh is the one call that happens
    // on every cold start, so it is the cheapest place to re-sync a permission
    // set that changed, and an extra key costs a structurally-typed client
    // nothing.
    return ok(issuedBody(issued))
  } catch (err) {
    return mobileAuthFailure(err)
  }
})
