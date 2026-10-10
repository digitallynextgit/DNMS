import { z } from "zod"

// -----------------------------------------------------------------------------
// Request bodies for /api/mobile/v1/auth/* and /api/mobile/v1/password.
//
// WHY NOT auth.schema.ts: those shapes are the WEB FORMS, bound to
// react-hook-form, and two of them (changePasswordSchema, resetPasswordSchema)
// require a `confirmPassword` the handset never sends - the app confirms in its
// own UI and posts once. Widening the web schemas so the app fits would remove a
// real guard from the web forms, so the two contracts stay apart.
//
// Shapes are matched to what the app actually sends today - see
// dnmsApp/src/features/auth/auth.api.ts. A field this file requires is a field an
// old build cannot supply, so "required" is a decision, never a default.
//
// A parsed body here holds a password or a Google id_token. NOTHING in this file
// or its callers may log one.
// -----------------------------------------------------------------------------

/**
 * What the handset says about itself. The app builds this in `currentDevice()`
 * (dnmsApp/src/features/auth/auth.api.ts:25-31).
 */
export const mobileDeviceSchema = z.object({
  /**
   * Stable per install. OPTIONAL because the app does not send one yet: without
   * it issueSession() mints an id, which still identifies this session but
   * cannot be matched to the previous install - so the "one live session per
   * handset" replace step is skipped and a re-login leaves the old row live.
   */
  deviceId: z.string().trim().min(1).max(200).optional(),
  /**
   * Deliberately a loose string, NOT z.enum(["ios","android"]).
   * server/mobile-auth.ts owns the platform rule (it trims, lowercases and
   * refuses anything else with INVALID_DEVICE 400) because lib/push-mobile.ts
   * routes FCM vs APNs off the stored value. Two lists would drift; one refuses.
   */
  platform: z.string().trim().min(1).max(20),
  /**
   * The handset model, e.g. "iPhone 15 Pro". The APP calls this `name`; the
   * server contract calls it `deviceName`. Both are accepted so neither side has
   * to send a field it does not believe in - mobileDeviceInput() folds them.
   */
  name: z.string().trim().max(120).optional(),
  deviceName: z.string().trim().max(120).optional(),
  appVersion: z.string().trim().max(40).optional(),
})

export type MobileDeviceBody = z.infer<typeof mobileDeviceSchema>

/**
 * POST /api/mobile/v1/auth/login
 *
 * `device` is REQUIRED. It is not decoration: the device columns are the whole
 * reason the mobile session is its own table rather than an OAuthGrant, and they
 * are what makes "which of these is my old phone?" answerable. Without a
 * platform issueSession() would refuse anyway, so requiring it here only moves
 * the same refusal to a 422 that names the missing field.
 *
 * `email` is not lowercased here on purpose: authorizeWithIdentity() runs
 * normalizeEmail() itself (server/auth.ts:137) and that must stay the one place
 * that decides what two addresses being "the same" means.
 */
export const mobileLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  device: mobileDeviceSchema,
})

export type MobileLoginInput = z.infer<typeof mobileLoginSchema>

/**
 * POST /api/mobile/v1/auth/google
 *
 * `idToken` is a Google ID token the handset obtained itself. It is verified
 * against Google's public keys server-side; the app is only a courier, so there
 * is nothing to validate here beyond "present and plausibly a token".
 *
 * max(4096) IS THE SECOND HALF OF A LEAK FIX, not a tidy-up. A real Google ID
 * token is 1-2 KB, so this refuses nothing a handset can legitimately send -
 * and google-auth-library builds its own failure messages by interpolating the
 * material it was given: build/src/auth/oauth2client.js:692 throws
 * `"Wrong number of segments in token: " + jwt`, which is THE RAW CREDENTIAL
 * inside an Error message, and the envelope branches (:703, :708, :724)
 * interpolate segments of it. The google route no longer echoes that message
 * anywhere (the first half of the fix, and the real one); this bound is what
 * stops an unbounded body reaching the verifier at all, so a future handler
 * that is less careful than that one has a kilobyte to mishandle and not a
 * megabyte.
 */
export const mobileGoogleSchema = z.object({
  idToken: z.string().min(1, "idToken is required").max(4096, "idToken is not a Google ID token"),
  device: mobileDeviceSchema,
})

export type MobileGoogleInput = z.infer<typeof mobileGoogleSchema>

/**
 * POST /api/mobile/v1/auth/pair
 *
 * A six-digit code minted by a browser that already holds a live DNMS web
 * session. The app posts `code` already stripped to digits
 * (dnmsApp src/features/auth/auth.api.ts), but a code is read off one screen and
 * retyped into another, so "123 456" and "123-456" have to be the same code.
 *
 * `code` is therefore a LOOSE string and NOT `.length(6)` - the same decision,
 * for the same reason, as `platform` above: server/mobile-pairing.ts owns the one
 * definition of what a pairing code is (normalizePairCode() strips every
 * non-digit and then requires exactly six), because that module is also what
 * burns the code and spends the failure budget. Two definitions of "six digits"
 * would drift, and the one that drifts is the one nobody is looking at.
 *
 * The cost is that a mistyped five-digit code comes back as 401
 * INVALID_PAIR_CODE rather than a 422 naming the field. Nothing real sees it:
 * the app's button stays disabled below six digits, so only a curl reaches it.
 *
 * max(40) is the only bound that matters here - it keeps a hostile body from
 * reaching a regex at all, while leaving room for every space and dash a human
 * types.
 *
 * `device` is REQUIRED, exactly as on the login and google doors: the device
 * columns are the whole reason a mobile session is its own table, and
 * issueSession() refuses a missing platform anyway - requiring it here only moves
 * the same refusal to a 422 that names the field.
 */
export const mobilePairSchema = z.object({
  code: z.string().min(1, "Enter the 6-digit code").max(40, "That is not a pairing code"),
  device: mobileDeviceSchema,
})

export type MobilePairInput = z.infer<typeof mobilePairSchema>

/** POST /api/mobile/v1/auth/refresh */
export const mobileRefreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
})

export type MobileRefreshInput = z.infer<typeof mobileRefreshSchema>

/**
 * POST /api/mobile/v1/auth/logout
 *
 * Optional: the app posts the refresh token when it still holds one and nothing
 * at all when it does not (auth.api.ts:99-105), in which case the access token
 * in the Authorization header identifies the same session.
 */
export const mobileLogoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
})

export type MobileLogoutInput = z.infer<typeof mobileLogoutSchema>

/**
 * POST /api/mobile/v1/password
 *
 * Deliberately NO `device`: the replacement session this route mints belongs to
 * the handset that called it, which the access token already identifies.
 * Accepting a device here would let a malformed `platform` fail issueSession()
 * AFTER the password had been changed and every session revoked - a lockout
 * earned by a typo in a field nobody needed.
 *
 * min(8) on newPassword mirrors setOwnPassword()'s own floor
 * (features/auth/server/auth.service.ts:160) so the caller gets the house 422
 * instead of a service-level 400.
 */
export const mobilePasswordSchema = z.object({
  /**
   * OPTIONAL, and the route bcrypt-verifies it whenever it IS present.
   *
   * Two callers, one route, and the difference between them is exactly this
   * field. The forced-change screen has no old password to offer - the account
   * is in `mustChangePassword` precisely because the password was issued or
   * admin-reset, and the person may never have known it - so requiring proof
   * there would fence off the one screen that clears the flag. A VOLUNTARY
   * change from Settings is the opposite case: it must prove ownership, or an
   * unlocked handset is enough to take over the account.
   *
   * It is the SERVER that has to carry this rather than the app choosing a
   * route, because the only endpoint that used to check the old password
   * (`PATCH /api/profile`) answers with a profile projection and no tokens, so
   * it self-revokes and locks the app out (setPassword() writes
   * users.passwordChangedAt). The app needs the bcrypt check AND the fresh pair
   * from the same call, and this is the only route that can mint one.
   *
   * min(1), NOT min(8): an old password set before the 8-char floor existed must
   * still be presentable as proof. The floor belongs on the NEW password only.
   * And `.optional()` with min(1) means an EMPTY string is a 422 rather than a
   * silently skipped check - the safe direction for a field whose absence turns
   * the verification off.
   */
  currentPassword: z.string().min(1, "Current password is required").optional(),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
})

export type MobilePasswordInput = z.infer<typeof mobilePasswordSchema>
