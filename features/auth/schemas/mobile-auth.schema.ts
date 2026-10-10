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
 * is nothing to validate here beyond "present".
 */
export const mobileGoogleSchema = z.object({
  idToken: z.string().min(1, "idToken is required"),
  device: mobileDeviceSchema,
})

export type MobileGoogleInput = z.infer<typeof mobileGoogleSchema>

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
 * `newPassword` only, and deliberately NO `device`: the replacement session this
 * route mints belongs to the handset that called it, which the access token
 * already identifies. Accepting a device here would let a malformed `platform`
 * fail issueSession() AFTER the password had been changed and every session
 * revoked - a lockout earned by a typo in a field nobody needed.
 *
 * min(8) mirrors setOwnPassword()'s own floor (features/auth/server/auth.service.ts:160)
 * so the caller gets the house 422 instead of a service-level 400.
 */
export const mobilePasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
})

export type MobilePasswordInput = z.infer<typeof mobilePasswordSchema>
