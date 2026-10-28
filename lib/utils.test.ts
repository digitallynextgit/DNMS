import { describe, expect, it } from "vitest"

import { formatLetterDate } from "./utils"

describe("formatLetterDate", () => {
  it("writes dates the way a letter would", () => {
    expect(formatLetterDate("2026-10-28")).toBe("28 Oct 2026")
    expect(formatLetterDate("2026-01-01")).toBe("1 Jan 2026")
    expect(formatLetterDate("2026-12-31")).toBe("31 Dec 2026")
  })

  it("takes an ISO timestamp or a Date, reading it as UTC", () => {
    expect(formatLetterDate("2026-10-28T00:00:00.000Z")).toBe("28 Oct 2026")
    // UTC midnight must not slip to the 27th for anyone behind UTC.
    expect(formatLetterDate(new Date("2026-10-28T00:00:00.000Z"))).toBe("28 Oct 2026")
  })

  it("gives nothing back for nothing", () => {
    expect(formatLetterDate(null)).toBe("")
    expect(formatLetterDate(undefined)).toBe("")
    expect(formatLetterDate("")).toBe("")
  })

  it("returns an unparseable string unchanged rather than 'Invalid Date'", () => {
    expect(formatLetterDate("not a date")).toBe("not a date")
    expect(formatLetterDate(new Date("nope"))).toBe("")
  })
})
