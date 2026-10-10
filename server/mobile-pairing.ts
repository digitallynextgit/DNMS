import "server-only"

import { randomInt } from "node:crypto"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import { runUnscoped, runWithTenant } from "@/server/tenant-context"
import { loadMembershipIfStillValid } from "@/server/identity"
import { sha256Hex } from "@/features/mcp/server/tokens"
import { rateLimited } from "@/lib/rate-limit"
import { MobileAuthError, type MobileIdentity } from "@/server/mobile-auth"

// -----------------------------------------------------------------------------
// Phone pairing: "sign the app in using the browser I am already signed in to."
//
// WHY THIS DOOR EXISTS AT ALL, and why it is the one most staff will use. The
// other two are shut for them: Google sign-in needs Android and iOS OAuth client
// ids that nobody has created yet (dnmsApp/docs/GOOGLE-SIGN-IN.md), and most DNMS
// people arrived through the WEB Google provider and have never typed a DNMS
// password - so email + password asks them for a credential they do not possess.
// Pairing asks for neither. It borrows the credential they are already holding:
// a live web session in a browser.
//
// THE FLOW, in two halves that never touch:
//   1. A signed-in browser POSTs /api/mobile/v1/auth/pair/start. That route reads
//      the ORDINARY web session and mints a six-digit code for its own caller.
//   2. The person types the code into the handset, which POSTs
//      /api/mobile/v1/auth/pair and gets a mobile session back.
// The CODE crosses the room, never the session cookie and never the password.
//
// =============================================================================
// THE THREAT MODEL, because six digits is not a secret
// =============================================================================
// Six digits is one of 1,000,000 - guessable the moment guessing is cheap and
// unlimited. So nothing here treats the code as a secret. Every property below
// exists to make guessing unprofitable instead, and removing any one of them
// puts a DNMS account one lucky request away from a stranger's phone:
//
//  1. FIVE MINUTES (TTL_MS). The window in which a guess is worth anything. A
//     code is also swept from the table by the next mint in its tenant, so an
//     expired row is not even a stale target.
//
//  2. SINGLE USE, AND BURNED BEFORE A SESSION EXISTS. redeemPairCode() DELETES
//     the row and checks that it deleted exactly one before it builds an
//     identity. The delete is the atomic claim - the same trick rotate() uses on
//     a refresh token (server/mobile-auth.ts) - so two requests racing with the
//     same code cannot both come back with a session. Issuing first and deleting
//     after would make a retried or replayed request a second live phone.
//
//  3. ONE LIVE CODE PER PERSON. A mint deletes the caller's previous code. This
//     is not tidiness: N live codes multiply the odds of a blind guess by N, and
//     "reload the page for a new one" would otherwise leave every earlier code
//     redeemable for its full five minutes.
//
//  4. A GLOBAL FAILURE BUDGET (MAX_FAILURES / FAILURE_WINDOW_MS). The per-IP
//     limit the routes apply is really a per-COMPANY limit - one office sits
//     behind one public IP (see ipThrottled in
//     features/auth/server/mobile-auth-http.ts) - so it cannot be tight enough to
//     stop guessing, and it does nothing at all against guesses spread over many
//     addresses. This budget is the guard that actually binds: once failed
//     redemptions pass the cap, redemption is refused for everyone until the
//     window passes. With the numbers below an attacker gets ~200 guesses per 5
//     minutes against the ~1 live code of a victim who is standing at the page,
//     i.e. 0.02% per window.
//     THE PRICE IS HONEST AND DELIBERATE: a flood of bad codes can switch
//     pairing off for the whole company for five minutes. That is survivable -
//     password and Google sign-in are untouched, and this is a sign-in FALLBACK -
//     whereas a brute-forced code is somebody else's phone inside DNMS.
//     Legitimate traffic is nowhere near it: a real failure is a typo or an
//     expired code, so a 50-person rollout day costs single digits.
//
//  5. TIED TO THE MINTING USER. The row carries userId / membershipId /
//     employeeId, and the identity handed back is built from those columns - never
//     from anything the handset sent. A redeemer chooses WHICH session to take
//     over only by knowing the digits; they cannot name a person.
//
//  6. NEVER LOGGED, NEVER STORED IN THE CLEAR. Only sha256Hex(code) reaches the
//     database, and no line in this file or either route prints a code. The hash
//     is not secrecy - 1,000,000 hashes is a millisecond of work, so anyone
//     holding the table can invert it - it is there so the plaintext never lands
//     in a row, a query log or a backup, which is where credentials actually leak
//     from. The TTL and the budgets are the security; the hash is the hygiene.
//
//  7. THE MINTING SIDE CANNOT BE DRIVEN FROM ANOTHER ORIGIN. Two independent
//     reasons, which is why POST is safe here: Auth.js sets its session cookie
//     SameSite=Lax (server/auth.ts configures no `cookies` override, so the
//     default stands), so a cross-site POST arrives with no session at all; and
//     no /api route sends CORS headers, so even a same-site-confused browser
//     could not read the code out of the response.
//
// THE OTHER WAY INTO THE MINTING ROUTE, and why it is closed. getSession()
// returns a DELEGATED session first (server/api-handler.ts), which is how a
// mobile Bearer or an AI connector grant acts as a person - so on paper either
// could mint a pairing code and escalate itself into a full second session.
// Neither can reach it: both dispatchers ask the LIVE api-policy before running
// anything, and /api/mobile is excluded there (features/mcp/server/api-policy.ts),
// a fact app/api/mobile/mobile-surface.test.ts asserts for every file on this
// surface. If that exclusion is ever loosened, this is the route that pays.
//
// TENANCY, the same rule as server/mobile-auth.ts: a lookup BY CODE decides the
// company, so it has to run unscoped - there is no tenant yet. The MINTING side
// is the opposite case and runs inside runWithTenant() with the tenant taken from
// the freshly re-read membership rather than from a week-old JWT claim.
// -----------------------------------------------------------------------------

/**
 * Five minutes, and it is a security parameter rather than a UX one - see point 1
 * of the threat model. Long enough to walk from the laptop to the phone, short
 * enough that a guessing window closes before it is worth opening.
 */
const TTL_MS = 5 * 60 * 1000

/** Six, because the app's input is six (dnmsApp src/app/(auth)/sign-in.tsx). */
const CODE_DIGITS = 6

/**
 * Failed redemptions allowed across the WHOLE server per window. Point 4 above is
 * why this is global and not per-IP, and what it costs.
 *
 * PER PROCESS, like everything in lib/rate-limit.ts: behind a PM2 cluster the real
 * budget is this number times the instance count, so the guessing bound below
 * scales with however many workers are running.
 */
const MAX_FAILURES = 200
const FAILURE_WINDOW_MS = 5 * 60 * 1000
const FAILURE_KEY = "mobile:pair:redeem:failures"

/**
 * Mint attempts before giving up. A collision needs the new code to equal another
 * LIVE code in some tenant, which is ~1 in a million per attempt, so five tries is
 * astronomically generous - it is here so a bug in the sweep can never become an
 * infinite loop.
 */
const MINT_ATTEMPTS = 5

/** What the browser shows. `code` exists only in this response - it is never re-readable. */
export interface MintedPairCode {
  code: string
  expiresAt: Date
}

/**
 * Set when a failure pushes the global bucket past MAX_FAILURES, so the NEXT
 * attempt is refused before it costs a database read.
 *
 * It exists because lib/rate-limit.ts has no peek: rateLimited() records a hit on
 * every call, and calling it to ask "am I locked out?" would count successful
 * pairings against a budget that is meant to count only failures.
 */
let failureLockUntil = 0

/**
 * Seconds to wait while the global failure budget is spent, or 0 when redemption
 * is open. Checked before the lookup, so a spent budget costs no database work.
 *
 * Returns the REMAINING seconds rather than a boolean so the route's Retry-After
 * cannot drift from FAILURE_WINDOW_MS the way a hand-written number would.
 */
export function pairingLockedForSeconds(): number {
  const remaining = failureLockUntil - Date.now()
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0
}

/** Call on EVERY refused redemption, and nowhere else. */
function recordFailedRedemption(): void {
  if (rateLimited(FAILURE_KEY, MAX_FAILURES, FAILURE_WINDOW_MS)) {
    failureLockUntil = Date.now() + FAILURE_WINDOW_MS
  }
}

/**
 * Six digits, uniformly.
 *
 * randomInt() rather than `randomBytes(4).readUInt32BE(0) % 1_000_000`, which the
 * dev-gateway prototype used and labelled "rejection-free". It is not: 2^32 is
 * 4,294,967,296, which is 4,294 whole millions plus 967,296, so codes 000000
 * through 967295 get one extra preimage each and are ~0.02% likelier than the
 * rest. That is far too small to matter against a five-minute window - but
 * randomInt() rejection-samples the bias away for free, so there is no reason to
 * reason about it at all.
 */
function newPairCode(): string {
  return String(randomInt(10 ** CODE_DIGITS)).padStart(CODE_DIGITS, "0")
}

/** P2002, the unique-index violation - same shape-check the services use. */
function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === "P2002"
}

/**
 * Digits only, or null.
 *
 * Tolerant of what a human types or pastes - "123 456", "123-456" - because the
 * code is read off a screen and retyped, and the only thing that carries meaning
 * is the digits. The length check is on the DIGITS, so "1 2 3 4 5 6" is six and
 * "1234567" is not.
 */
export function normalizePairCode(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, "")
  return digits.length === CODE_DIGITS ? digits : null
}

// -----------------------------------------------------------------------------
// Mint - the browser half
// -----------------------------------------------------------------------------

/**
 * Mint a code for the person behind `session`, which the caller has ALREADY
 * authenticated with the ordinary web session (withSession, i.e. getSession() plus
 * the staff guard). This function trusts the session for one thing only - the
 * membership id - and re-reads everything else.
 *
 * Throws MobileAuthError("NOT_STAFF", 403) when that re-read says the membership
 * is no longer a live staff membership. The session is a stateless 7-day JWT
 * (server/auth.ts), so its claims can outlive the account they describe by a
 * week; loadMembershipIfStillValid() is the same gate sign-in applies, and it is
 * what makes a suspended tenant, a READ_ONLY tenant, a lapsed TRIAL, a
 * deactivated employee and a revoked membership all unable to mint. Without it
 * this route would be a way to turn a cookie that should already be dead into a
 * fresh 30-day mobile session.
 */
export async function mintPairCode(session: Session): Promise<MintedPairCode> {
  const membership = await loadMembershipIfStillValid(session.user.membershipId)
  // `profileId !== session.user.id` is the paranoid half: the JWT's `id` is the
  // employees row, and a membership that now points at a different profile is not
  // this person's to borrow.
  if (!membership || membership.kind !== "STAFF" || membership.profileId !== session.user.id) {
    throw new MobileAuthError("NOT_STAFF", "This DNMS account is not active in this workspace", 403)
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + TTL_MS)

  // runWithTenant, not the ambient context getSession() entered: the STRONG form
  // (tenant-context.ts warns enterTenant's enterWith can outlive its call), and the
  // tenant comes from the membership row just read rather than from a JWT claim
  // that is up to seven days old. The guard then narrows the deletes and stamps the
  // create - and the create names tenantId anyway, because mobile_pair_codes has no
  // tenant_spine DEFAULT to fall back on (see the migration header).
  return runWithTenant({ tenantId: membership.tenantId, slug: membership.tenantSlug }, async () => {
    // user_id comes from the MEMBERSHIP ROW, never from session.user.userId.
    // ActiveMembership does not carry it, so this is one primary-key read - worth
    // it, because user_id is the only column here with no foreign key behind it
    // (mobile_sessions.user_id has none either), so a wrong value is not caught
    // by anything. The session callback defaults the claim to "" for a token
    // minted before multi-tenancy (server/auth.ts), and an empty user_id would
    // propagate into mobile_sessions and make revokeAllForUser("") a sweep that
    // matches every such row in every company. Reading it costs one lookup and
    // removes the whole class.
    const owner = await db.membership.findUnique({
      where: { id: membership.id },
      select: { userId: true },
    })
    if (!owner?.userId) {
      throw new MobileAuthError(
        "NOT_STAFF",
        "This DNMS account is not active in this workspace",
        403,
      )
    }

    // One statement, two jobs. Expired rows go because this is the only sweep the
    // table gets; this person's previous code goes because leaving it live would
    // mean every page reload added one more guessable target (threat model, 3).
    await db.mobilePairCode.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { membershipId: membership.id }] },
    })

    for (let attempt = 1; attempt <= MINT_ATTEMPTS; attempt++) {
      const code = newPairCode()
      try {
        await db.mobilePairCode.create({
          data: {
            tenantId: membership.tenantId,
            codeHash: sha256Hex(code),
            userId: owner.userId,
            membershipId: membership.id,
            employeeId: membership.profileId,
            // Both timestamps from THIS process's clock, so expires_at - created_at
            // is the TTL and not the TTL plus the drift between two machines. The
            // same one-clock rule issueSession() states at length, for the same
            // reason: expiresAt is COMPARED against new Date() on redemption.
            createdAt: now,
            expiresAt,
          },
        })
        return { code, expiresAt }
      } catch (err) {
        // The only expected failure: these six digits are already a live code in
        // some tenant (the index is global, like mobile_tokens.token_hash). Draw
        // again. Anything else is a real error and must not be retried silently.
        if (!isUniqueViolation(err)) throw err
      }
    }
    // Unreachable short of a broken sweep. A 500 is the right answer - minting a
    // code that collides with someone else's would make one of them unredeemable.
    throw new Error("Could not mint a unique pairing code")
  })
}

// -----------------------------------------------------------------------------
// Redeem - the handset half
// -----------------------------------------------------------------------------

/**
 * Burn `code` and return the identity it was minted for, or null.
 *
 * NULL IS ONE ANSWER FOR FOUR FACTS - never minted, expired, already redeemed, and
 * won by a racing request. That is deliberate: distinguishing them would turn this
 * route into an oracle that says "that code exists, keep trying", which is exactly
 * the help a guesser needs. The caller answers all four with INVALID_PAIR_CODE.
 *
 * Throws MobileAuthError("NOT_STAFF", 403) for the one case that is NOT a bad
 * guess: a real code whose owner stopped being live staff in the five minutes
 * since it was minted. They get a sentence that fits what happened rather than
 * "that code is not valid", and the code is already burned by then either way.
 *
 * NOTHING in here logs the code, on any path.
 */
export async function redeemPairCode(code: string): Promise<MobileIdentity | null> {
  const digits = normalizePairCode(code)
  if (!digits) {
    // A wrong-length code never reaches the database, but it still spends budget:
    // a guesser must not be able to probe the limiter for free, and the app's own
    // UI will not submit anything but six digits.
    recordFailedRedemption()
    return null
  }

  // Unscoped, with the same reason as every read in server/mobile-auth.ts: the code
  // decides the company, so narrowing by a tenant we have not identified yet would
  // filter the row out - and throw outright under TENANT_ENFORCEMENT=strict.
  return runUnscoped("mobile app: the pairing code decides the company", async () => {
    const row = await db.mobilePairCode.findUnique({ where: { codeHash: sha256Hex(digits) } })
    if (!row || row.expiresAt <= new Date()) {
      recordFailedRedemption()
      return null
    }

    // ---------------------------------------------------------------------------
    // THE BURN, and it happens HERE - before any membership is loaded and long
    // before issueSession() is called. deleteMany's count is the atomic claim: the
    // row either existed when this statement ran, in which case this request owns
    // it, or it did not, in which case another request already won and this one
    // gets the same null a wrong guess gets. Nothing downstream can resurrect it,
    // so a retry, a double-tap or a replay cannot produce a second phone.
    // ---------------------------------------------------------------------------
    const burned = await db.mobilePairCode.deleteMany({ where: { id: row.id } })
    if (burned.count !== 1) {
      recordFailedRedemption()
      return null
    }

    // Every sign-in gate, applied to the person the CODE names and not to anyone
    // the handset claims to be. Same call as issueSession() will make again a
    // moment later; cheap, and this one is what lets the refusal be accurate.
    const membership = await loadMembershipIfStillValid(row.membershipId)
    if (!membership || membership.kind !== "STAFF" || membership.profileId !== row.employeeId) {
      throw new MobileAuthError("NOT_STAFF", "This DNMS account is no longer active", 403)
    }

    // email and name are not on the code row on purpose - they are mutable facts
    // about a person, and a five-minute-old copy of them is a worse answer than a
    // read. This is the same lookup sessionFor() does in server/mobile-auth.ts.
    const user = await db.user.findUnique({
      where: { id: row.userId },
      select: { email: true, name: true },
    })
    if (!user) {
      throw new MobileAuthError("NOT_STAFF", "This DNMS account no longer exists", 403)
    }

    // Field for field what authorizeWithIdentity() returns, so issueSession()
    // cannot tell this door from the password one - the same contract the Google
    // route builds by hand (app/api/mobile/v1/auth/google/route.ts).
    return {
      id: membership.profileId,
      email: user.email,
      name: user.name,
      kind: "employee",
      userId: row.userId,
      membershipId: membership.id,
      tenantId: membership.tenantId,
      tenantSlug: membership.tenantSlug,
      // Carried, not enforced. Pairing proves a live WEB session, which the web's
      // own change-password fence already stands in front of; the flag still
      // reaches the app, and the dispatcher is what fences the data routes with it.
      mustChangePassword: membership.mustChangePassword,
    } satisfies MobileIdentity
  })
}
