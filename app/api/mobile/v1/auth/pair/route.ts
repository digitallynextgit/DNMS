import { withErrorHandler } from "@/server/api-handler"
import { ok, fail } from "@/lib/api-response"
import { issueSession } from "@/server/mobile-auth"
import { pairingLockedForSeconds, redeemPairCode } from "@/server/mobile-pairing"
import { mobilePairSchema } from "@/features/auth/schemas/mobile-auth.schema"
import {
  ipThrottled,
  issuedBody,
  mobileAuthFailure,
  mobileDeviceInput,
  readJsonBody,
} from "@/features/auth/server/mobile-auth-http"

// -----------------------------------------------------------------------------
// POST /api/mobile/v1/auth/pair - redeem a six-digit code for a mobile session.
//
// The handset half of the pairing flow. The browser half is ../pair/start, and
// server/mobile-pairing.ts holds both plus the threat model that explains why a
// six-digit code is safe to post at all. Read that banner before changing
// anything here: every line below is one of its properties.
//
// SELF-AUTHENTICATING, and it has to be twice over. /api/mobile is a
// PUBLIC_PREFIX in proxy.ts, so nothing in front of this file checks anything -
// and this route is OPEN by design, because no access token can exist yet. The
// credential it verifies is the pairing code, which redeemPairCode() reads,
// judges and BURNS; `null` from it is the only verdict this handler needs.
//
// ONE ANSWER FOR FOUR FACTS. Never minted, expired, already redeemed, and lost
// to a racing request all come back as INVALID_PAIR_CODE. Telling them apart
// would say "that code exists, keep going" to someone guessing, which with a
// million-wide code space is the only hint that matters.
//
// NOTHING in this file logs. The body holds a live pairing code and the response
// holds two bearer tokens; there is no log line worth either.
//
// THE WIRE CONTRACT IS THE APP'S, UNCHANGED. loginWithPairCode()
// (dnmsApp src/features/auth/auth.api.ts) already posts {code, device} and reads
// a LoginResponse, so this route answers with issuedBody() - the same body
// login, google, refresh and password return - and reuses the gateway
// prototype's INVALID_PAIR_CODE code and wording so the app's existing error
// path needs no branch.
// -----------------------------------------------------------------------------

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const POST = withErrorHandler(async (req) => {
  // LOOSE, on purpose, and it is not the guessing guard. One office is one public
  // IP (see ipThrottled in features/auth/server/mobile-auth-http.ts), so a tight
  // number here would lock a whole company out on a rollout day while barely
  // inconveniencing an attacker with two addresses. The guard that actually binds
  // guessing is the GLOBAL failure budget below.
  const flooding = ipThrottled(req, "pair", 120, 15 * 60_000)
  if (flooding) return flooding

  // The global failure budget, checked BEFORE the body is parsed so a spent
  // budget costs nothing. 503 rather than 429: this is not "YOU have had too
  // many", it is "this door is shut for everyone right now", and the app shows
  // the message rather than keying off the code. Retry-After comes from the
  // module so it cannot drift from the window it describes.
  const lockedFor = pairingLockedForSeconds()
  if (lockedFor > 0) {
    const locked = fail(
      "PAIRING_UNAVAILABLE",
      "Pairing is temporarily unavailable. Sign in with your password, or try again shortly.",
      503,
    )
    locked.headers.set("Retry-After", String(lockedFor))
    return locked
  }

  const body = mobilePairSchema.parse(await readJsonBody(req))

  // One try for both calls because both throw the same class and map the same
  // way: MobileAuthError -> its own code and status, anything else rethrown for
  // withErrorHandler's 500 funnel. Swallowing here would answer 401 for a
  // database outage, and the app treats a coded 401 as a verdict on its tokens.
  try {
    // Reads the code, burns it, and hands back the identity it was minted FOR -
    // built from the row's own columns, never from anything in `body`.
    const identity = await redeemPairCode(body.code)

    // Never minted, expired, already redeemed, or lost to a racing request. See
    // the note above: one answer for all four.
    if (!identity) {
      return fail("INVALID_PAIR_CODE", "That code is not valid. Generate a new one.", 401)
    }

    // The code is already gone by this point, so a refusal here costs the user a
    // trip back to the browser for a new one - which is correct, and the whole
    // reason the burn is where it is: the alternative is a code that mints twice.
    const issued = await issueSession(identity, mobileDeviceInput(body.device))
    return ok(issuedBody(issued))
  } catch (err) {
    // NOT_STAFF (403) when the account stopped being live staff since the mint,
    // or INVALID_DEVICE (400) for a platform that is not ios/android.
    return mobileAuthFailure(err)
  }
})
