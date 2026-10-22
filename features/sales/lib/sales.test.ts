import { describe, expect, it } from "vitest"

import { duplicateKey, followUpState, phoneDigits, telLink, whatsappLink } from "./sales"

describe("phoneDigits", () => {
  it("turns the usual Indian shapes into one number", () => {
    for (const raw of ["+91 98765 43210", "098765 43210", "9876543210", "0091-9876543210"]) {
      expect(phoneDigits(raw)).toBe("919876543210")
    }
  })
  it("ignores what can't be a phone", () => {
    expect(phoneDigits("")).toBeNull()
    expect(phoneDigits("n/a")).toBeNull()
    expect(phoneDigits("12345")).toBeNull()
  })
  it("makes call and WhatsApp links", () => {
    expect(telLink("98765 43210")).toBe("tel:+919876543210")
    expect(whatsappLink("98765 43210", "Hi there")).toBe(
      "https://wa.me/919876543210?text=Hi%20there",
    )
    expect(whatsappLink(null)).toBeNull()
  })
})

describe("duplicateKey", () => {
  it("matches on the phone however it is written", () => {
    expect(duplicateKey({ business: "A", phone: "+91 98765 43210" })).toBe(
      duplicateKey({ business: "B", phone: "09876543210" }),
    )
  })
  it("falls back to business and area", () => {
    expect(duplicateKey({ business: "Sunrise Boys Hostel", area: "Sector 62" })).toBe(
      duplicateKey({ business: "sunrise boys  hostel", area: "sector-62" }),
    )
    expect(duplicateKey({ business: "Sunrise", area: "Sector 62" })).not.toBe(
      duplicateKey({ business: "Sunrise", area: "Sector 18" }),
    )
  })
})

describe("followUpState", () => {
  it("is overdue, today or upcoming", () => {
    expect(followUpState("2026-10-21", "2026-10-22")).toBe("OVERDUE")
    expect(followUpState("2026-10-22", "2026-10-22")).toBe("TODAY")
    expect(followUpState("2026-10-25", "2026-10-22")).toBe("UPCOMING")
    expect(followUpState(null, "2026-10-22")).toBeNull()
  })
})
