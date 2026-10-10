import { withSession } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { mintPairCode } from "@/server/mobile-pairing"
import { ipThrottled, mobileAuthFailure, throttled } from "@/features/auth/server/mobile-auth-http"

// -----------------------------------------------------------------------------
// POST /api/mobile/v1/auth/pair/start - mint a pairing code for the browser that
// is already signed in to DNMS.
//
// THE HAZARD THIS FILE IS, SPELLED OUT. It lives under /api/mobile, which is a
// PUBLIC_PREFIX in proxy.ts (:51-55) - the Edge waves the WHOLE namespace through
// with no session check, because the other files here verify opaque Bearer tokens
// and the Edge has no database to verify them against. So this route gets NO
// protection from the proxy, and it is the one route on this surface whose
// credential is an ordinary web session rather than a mobile token. If it simply
// read the session the way every /api route outside this prefix does and trusted
// the proxy to have required one, it would hand a pairing code - and therefore a
// 30-day mobile session - to any anonymous POST on the internet.
//
// withSession() is the explicit guard that closes that: getSession() plus "no
// session is a 401" plus assertStaff() (server/api-handler.ts). It is named in
// app/api/mobile/mobile-surface.test.ts beside this path, which is what forces a
// reviewer to read this line if the guard is ever changed.
//
// WHY A WEB SESSION IS AN ACCEPTABLE CREDENTIAL FOR A MOBILE SESSION: it is a
// strictly STRONGER one. Whoever holds it already has every DNMS screen in a
// browser, so pairing grants them nothing they did not have - it only moves it to
// a device they are holding. That is also why this route takes NO body at all:
// there is nothing for a caller to choose. It mints for its own caller or it
// refuses, so it cannot be aimed at anyone.
//
// The code, the TTL, the single-use burn and the threat model all live in
// server/mobile-pairing.ts. The redeeming half is ../route.ts.
//
// NOTHING in this file logs. The response body IS a live credential for the next
// five minutes.
// -----------------------------------------------------------------------------

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const POST = withSession(async (req, _ctx, session) => {
  // Loose, for the usual reason: one office is one public IP, so this bucket is
  // really per-company (ipThrottled, features/auth/server/mobile-auth-http.ts).
  // It only exists to stop a flood that never reaches the per-user cap below.
  const flooding = ipThrottled(req, "pair-start", 120, 15 * 60_000)
  if (flooding) return flooding

  // The cap that matters on this side. Keyed on the USER - not the IP and not the
  // membership - because the thing being rationed is "how many live codes can one
  // person churn through", and a user is the subject a browser session identifies.
  // 10 per 5 minutes is a dozen frustrated page reloads; it is not a script
  // farming codes to raise the odds that a guesser hits one of them.
  const churning = throttled(`mobile:pair-start:user:${session.user.userId}`, 10, 5 * 60_000)
  if (churning) return churning

  try {
    // Re-reads the membership and refuses a session whose account is no longer
    // live staff - see mintPairCode(). The JWT here can be up to seven days old.
    const minted = await mintPairCode(session)

    const res = ok({
      code: minted.code,
      expiresAt: minted.expiresAt.toISOString(),
      /** Seconds, so the page can count down without trusting the browser's clock. */
      expiresIn: Math.max(0, Math.round((minted.expiresAt.getTime() - Date.now()) / 1000)),
    })
    // A live credential must not sit in a proxy, a browser cache or a back-button
    // restore. The gateway prototype set the same header on its pairing page.
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
    return res
  } catch (err) {
    // NOT_STAFF (403) for a membership that is no longer live. Anything else is
    // rethrown into withSession()'s own funnel and logged as a 500.
    return mobileAuthFailure(err)
  }
})
