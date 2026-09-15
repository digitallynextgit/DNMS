import { describe, expect, it } from "vitest"

import { isLoopbackOrigin, isPushDeliverable } from "./push-targets"

const PROD = "https://dnms.digitallynext.com"
const DEV = "http://localhost:3000"

describe("isLoopbackOrigin", () => {
  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:3000",
    "http://macbook.local:3000",
  ])("%s is a development origin", (origin) => {
    expect(isLoopbackOrigin(origin)).toBe(true)
  })

  it.each([PROD, "https://staging.digitallynext.com", "http://187.127.159.101:3000"])(
    "%s is not",
    (origin) => {
      expect(isLoopbackOrigin(origin)).toBe(false)
    },
  )

  it("does not throw on a malformed origin", () => {
    expect(isLoopbackOrigin("not a url")).toBe(false)
  })
})

describe("isPushDeliverable", () => {
  // The reported bug: one notification arriving twice, once from the deployed
  // site and once from a localhost service worker.
  it("never delivers a production push to a localhost registration", () => {
    expect(isPushDeliverable(DEV, PROD)).toBe(false)
  })

  it("still delivers to the production registration", () => {
    expect(isPushDeliverable(PROD, PROD)).toBe(true)
  })

  it("lets a dev server push to its own localhost registration", () => {
    expect(isPushDeliverable(DEV, DEV)).toBe(true)
  })

  it("does not deliver to another site's registration", () => {
    expect(isPushDeliverable("https://staging.digitallynext.com", PROD)).toBe(false)
  })

  // The failure mode that matters: a missing env var must not silence everyone.
  describe("when the app origin is unknown", () => {
    it.each([null, undefined, ""])("still delivers to real registrations (%s)", (appOrigin) => {
      expect(isPushDeliverable(PROD, appOrigin)).toBe(true)
    })

    it("still refuses localhost, which is the whole point", () => {
      expect(isPushDeliverable(DEV, null)).toBe(false)
    })

    it("still delivers to legacy rows rather than going silent", () => {
      expect(isPushDeliverable(null, null)).toBe(true)
    })
  })

  describe("legacy rows written before the column existed", () => {
    it("are excluded once we know our own origin - their origin is unknowable", () => {
      expect(isPushDeliverable(null, PROD)).toBe(false)
      expect(isPushDeliverable(undefined, PROD)).toBe(false)
    })
  })
})
