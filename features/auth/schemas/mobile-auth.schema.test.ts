import { describe, expect, it } from "vitest"

import { mobileGoogleSchema } from "./mobile-auth.schema"

// =============================================================================
// The bound on `idToken` is a SECURITY bound, not a sanity one, so it gets a
// test rather than a comment alone.
//
// google-auth-library writes the material it was handed into its own error
// messages - build/src/auth/oauth2client.js:692 throws
// `"Wrong number of segments in token: " + jwt` - so the id_token is one
// careless `err.message` away from the production log for the whole lifetime of
// this dependency. The route is fixed not to echo that message (asserted in
// app/api/mobile/mobile-surface.test.ts); this is the other half, capping what
// can reach the verifier at all.
//
// It is a plain zod module with no imports of ours, so this file needs no mocks.
// =============================================================================

const token = (length: number) => "a".repeat(length)
const DEVICE = { platform: "ios", name: "iPhone 15 Pro" }

describe("mobileGoogleSchema.idToken", () => {
  it("accepts a real-sized Google ID token", () => {
    // Google's own are 1-2 KB; 2048 is a comfortable live token.
    const parsed = mobileGoogleSchema.safeParse({ idToken: token(2048), device: DEVICE })
    expect(parsed.success).toBe(true)
  })

  it("accepts the largest token the bound allows", () => {
    expect(mobileGoogleSchema.safeParse({ idToken: token(4096), device: DEVICE }).success).toBe(
      true,
    )
  })

  it("refuses anything larger, because nothing that large is a Google ID token", () => {
    const parsed = mobileGoogleSchema.safeParse({ idToken: token(4097), device: DEVICE })
    expect(parsed.success).toBe(false)
    // 422 VALIDATION_ERROR through withErrorHandler, and the id_token never
    // reaches verifyIdToken() - so no library error message is built out of it.
    expect(parsed.error?.issues[0]?.code).toBe("too_big")
  })

  it("still refuses an empty one", () => {
    expect(mobileGoogleSchema.safeParse({ idToken: "", device: DEVICE }).success).toBe(false)
  })

  it("requires the device block - the session is minted against it", () => {
    expect(mobileGoogleSchema.safeParse({ idToken: token(1200) }).success).toBe(false)
  })
})
