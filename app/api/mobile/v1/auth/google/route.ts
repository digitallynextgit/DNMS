import { Auth } from "googleapis"
import { withErrorHandler } from "@/server/api-handler"
import { ok, fail } from "@/lib/api-response"
import { findLoginUser, loadActiveMemberships, normalizeEmail } from "@/server/identity"
import { issueSession, type MobileIdentity } from "@/server/mobile-auth"
import { mobileGoogleSchema } from "@/features/auth/schemas/mobile-auth.schema"
import {
  ipThrottled,
  issuedBody,
  mobileAuthFailure,
  mobileDeviceInput,
  readJsonBody,
} from "@/features/auth/server/mobile-auth-http"

// -----------------------------------------------------------------------------
// POST /api/mobile/v1/auth/google - a Google ID token, from the handset.
//
// WHY THIS ROUTE EXISTS AT ALL: most DNMS staff sign in to the web app with
// Google and have never typed a DNMS password, so without this the app is
// unusable for them. The web path is the next-auth Google provider; a native app
// cannot use it, because that flow needs a browser redirect and a client secret,
// and a secret shipped inside an app is not a secret.
//
// THE SHAPE OF THE TRUST. The handset does the OAuth dance itself and sends only
// the resulting id_token. That token is a CLIENT ASSERTION and is worth nothing
// until Google's own signature over it is checked - which is what happens below,
// against Google's public keys, in this process. There is no version of this
// route in which the app's word is taken for anything.
//
// TWO GATES, both mandatory, both mirroring server/auth.ts's callbacks.signIn
// (:211-234), which is the web Google door:
//   1. email_verified. DNMS matches people BY EMAIL. Anyone can attach any
//      address to a Google account; only email_verified says Google checked it.
//      Without this check, "sign in as my manager" costs one unverified alias.
//   2. The address must ALREADY belong to an active DNMS employee. There is NO
//      SELF-REGISTRATION in DNMS and there is none here - a personal Gmail that
//      passes Google's verification perfectly still gets a 403.
//
// Ported from dev-gateway/server.mjs handleGoogle(), with two corrections the
// gateway could not make: the session it issues carries tenantId (the gateway has
// no concept of a tenant), and the employee lookup goes through the platform
// identity (users + memberships) rather than straight at employees.email.
//
// LOGGING, and the rule is wider than it first looks: no line in this file may
// log the id_token, any SEGMENT of it, or ANY STRING THE VERIFIER BUILT OUT OF
// IT. That last clause is the one that bites, and this route got it wrong until
// the fix below - google-auth-library writes the raw token into its own error
// message (oauth2client.js:692), so echoing `err.message` was echoing the
// credential. The catch block now logs the error CLASS and nothing else.
//
// The surviving console.warn carries a reason and a work email address - the
// same thing server/identity.ts:319 already logs - and it is the only reason a
// "why can't I sign in?" ticket is answerable.
// -----------------------------------------------------------------------------

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Reused across requests so Google's signing certificates are fetched once and
 * cached by the library, not on every sign-in. Constructed with no client id:
 * the audience is supplied per call, because there is more than one.
 */
const googleClient = new Auth.OAuth2Client()

/**
 * Every OAuth client of OURS that may mint an id_token for a DNMS person.
 *
 * Google stamps the client that ASKED as the token's `aud`, and the app signs in
 * with the Android or iOS client - not the web one DNMS already has. All three
 * must be listed or a perfectly valid sign-in is rejected as "wrong audience"
 * (dnmsApp/docs/GOOGLE-SIGN-IN.md). An Android OAuth client has no secret by
 * design; it is validated by package name + signing-certificate SHA-1, so a
 * release build signed by EAS needs its own client id added here.
 *
 * Read per request rather than at module load so a value added to the
 * environment takes effect on restart without a rebuild.
 */
function googleAudiences(): string[] {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
  ].filter((id): id is string => Boolean(id))
}

/**
 * The error's CLASS, with no message and no payload attached - the only thing
 * from a verifier failure this file is allowed to log. See the catch block.
 *
 * `constructor.name` rather than `.name`: `.name` is a writable own property, so
 * a library could in principle put token text there, and `constructor.name` is
 * not reachable that way. Sliced because this value goes straight into a log
 * line and a class name is a short identifier by definition.
 */
function errorClass(err: unknown): string {
  if (err instanceof Error) return err.constructor?.name?.slice(0, 60) || "Error"
  return typeof err
}

export const POST = withErrorHandler(async (req) => {
  // Loose on purpose - one office is one IP, and a rollout day is 50 people
  // signing in on the same Wi-Fi. There is nothing to brute-force here anyway:
  // an id_token is Google-signed, so a wrong guess is not a near miss.
  const flooding = ipThrottled(req, "google", 240, 15 * 60_000)
  if (flooding) return flooding

  const audience = googleAudiences()
  // 503, not 500: the server is fine, it is unconfigured. An empty audience list
  // would make verifyIdToken() accept a token minted for ANY Google client, so
  // this is a refusal and not a warning.
  if (audience.length === 0) {
    return fail("GOOGLE_NOT_CONFIGURED", "Google sign-in is not configured on this server", 503)
  }

  const body = mobileGoogleSchema.parse(await readJsonBody(req))

  let payload: Auth.TokenPayload | undefined
  try {
    // Verifies the signature against Google's published keys AND checks `iss`
    // (accounts.google.com), `exp` and that `aud` is one of ours. All four
    // matter; dropping the audience check would let a token minted for any
    // unrelated Google app sign its owner in here.
    const ticket = await googleClient.verifyIdToken({ idToken: body.idToken, audience })
    payload = ticket.getPayload()
  } catch (err) {
    // THE CLASS ONLY - never err.message, and never `err` itself (which prints
    // the message). google-auth-library builds these messages out of the token
    // it was handed: oauth2client.js:692 throws
    // `"Wrong number of segments in token: " + jwt`, so a handset that posts a
    // truncated or garbage token used to put that string verbatim into the
    // production log, where a VALID id_token posted to a misconfigured build is
    // replayable for its whole lifetime by anyone with log access. :703, :708
    // and :724 interpolate segments[0] or the decoded envelope for the same
    // reason. There is no safe subset to keep, because the unsafe ones are
    // exactly the ones a broken client produces.
    //
    // WHAT THIS COSTS, stated plainly: the log no longer distinguishes a wrong
    // audience from an expired token from a bad signature. Accepted - the app's
    // branch is one 401 either way, the audience list is the thing that gets
    // misconfigured and that failure is already visible as every sign-in failing
    // at once, and the ticket support actually receives ("X cannot sign in") is
    // answered by the NO_ACCOUNT warning below, which names the address.
    console.warn("[mobile/auth/google] id_token rejected by verifyIdToken:", errorClass(err))
    return fail("INVALID_GOOGLE_TOKEN", "Could not verify that Google sign-in", 401)
  }

  // STRICTER than the gateway, which only refused email_verified === false and so
  // let an absent claim through. Absent is not verified.
  if (!payload?.email || payload.email_verified !== true) {
    return fail("INVALID_GOOGLE_TOKEN", "That Google account has no verified email address", 401)
  }

  const email = normalizeEmail(payload.email)

  // ---------------------------------------------------------------------------
  // The same gate as the web, in the same order (server/auth.ts:216-222). The web
  // answers by returning a URL ("/login?error=no_account"), which denies the
  // sign-in and lets /login show the reason; an app needs a code, so each of
  // those reasons becomes one here.
  // ---------------------------------------------------------------------------
  const platformUser = await findLoginUser(email)
  if (!platformUser) {
    console.warn(`[mobile/auth/google] no DNMS identity for ${email}`)
    return fail("NO_ACCOUNT", "That Google account is not a DNMS employee", 403)
  }
  if (!platformUser.isActive) {
    return fail("ACCOUNT_INACTIVE", "This DNMS account has been deactivated", 403)
  }

  // pickMembership() is module-private in server/auth.ts and the agreed diff to
  // that file was ONE word, so this reproduces its STAFF branch instead of
  // exporting a second symbol: loadActiveMemberships() already orders by
  // createdAt asc, so .find() returns the same (oldest) row pickMembership(ms,
  // "STAFF") would. Google is a STAFF DOOR ONLY - the web provider refuses a
  // CLIENT membership at server/auth.ts:222 and so does this.
  const memberships = await loadActiveMemberships(platformUser.id)
  const membership = memberships.find((m) => m.kind === "STAFF")
  if (!membership) {
    // A real person with a live CLIENT membership and no STAFF one. The web
    // collapses this into no_account; the app can do better and send them to the
    // portal, so it gets the same NOT_STAFF code and sentence the login route
    // uses for the identical situation. A person whose STAFF membership was
    // deactivated has NO active memberships at all and reads as NO_ACCOUNT,
    // which is the true answer - they are no longer an employee.
    const client = memberships.length > 0
    return fail(
      client ? "NOT_STAFF" : "NO_ACCOUNT",
      client
        ? "This is a client portal account - please sign in on the DNMS website"
        : "That Google account is not a DNMS employee",
      403,
    )
  }

  // The same identifiers authorizeWithIdentity() returns, so issueSession()
  // cannot tell the two doors apart - exactly the reason callbacks.signIn builds
  // this object field for field at server/auth.ts:225-231.
  const identity: MobileIdentity = {
    id: membership.profileId,
    email: platformUser.email,
    name: platformUser.name,
    kind: "employee",
    userId: platformUser.id,
    membershipId: membership.id,
    tenantId: membership.tenantId,
    tenantSlug: membership.tenantSlug,
    // Carried, not enforced: a Google sign-in proves the Google credential, so a
    // DNMS password this person has never set is not in their way. The flag
    // still reaches the app, which fences the UI with it.
    mustChangePassword: platformUser.mustChangePassword,
  }

  try {
    const issued = await issueSession(identity, mobileDeviceInput(body.device))
    return ok(issuedBody(issued))
  } catch (err) {
    return mobileAuthFailure(err)
  }
})
