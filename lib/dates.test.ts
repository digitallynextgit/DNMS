import { describe, expect, it } from "vitest"

import { startOfDayUTC, workingDaysBetween } from "./dates"

// Anchor dates, so a reader does not have to work out the weekday:
//   2026-09-23 Wed   2026-09-24 Thu   2026-09-25 Fri
//   2026-09-26 Sat   2026-09-27 Sun   2026-09-28 Mon
const d = (iso: string) => startOfDayUTC(iso)
const count = (from: string, to: string, holidays: string[] = []) =>
  workingDaysBetween(d(from), d(to), new Set(holidays)).length

describe("workingDaysBetween", () => {
  it("counts a single working day as one", () => {
    expect(count("2026-09-23", "2026-09-23")).toBe(1)
  })

  it("counts both ends of a range (the 2-day WFH case)", () => {
    expect(count("2026-09-23", "2026-09-24")).toBe(2)
  })

  it("skips the weekend inside a range", () => {
    // Fri -> Mon is four calendar days but only two working ones.
    expect(count("2026-09-25", "2026-09-28")).toBe(2)
  })

  it("skips company holidays inside a range", () => {
    expect(count("2026-09-23", "2026-09-25", ["2026-09-24"])).toBe(2)
  })

  it("returns nothing for a weekend-only range", () => {
    expect(count("2026-09-26", "2026-09-27")).toBe(0)
  })

  it("returns nothing when the end is before the start", () => {
    expect(count("2026-09-25", "2026-09-23")).toBe(0)
  })

  it("spans a month boundary", () => {
    // Wed 30 Sep + Thu 1 Oct - one day charged to each month's WFH quota.
    expect(count("2026-09-30", "2026-10-01")).toBe(2)
  })

  it("returns UTC midnights, so a DATE column round-trips unchanged", () => {
    const days = workingDaysBetween(d("2026-09-23"), d("2026-09-24"))
    expect(days.map((x) => x.toISOString())).toEqual([
      "2026-09-23T00:00:00.000Z",
      "2026-09-24T00:00:00.000Z",
    ])
  })

  it("does not mutate the dates it is given", () => {
    const start = d("2026-09-23")
    const end = d("2026-09-25")
    workingDaysBetween(start, end)
    expect(start.toISOString()).toBe("2026-09-23T00:00:00.000Z")
    expect(end.toISOString()).toBe("2026-09-25T00:00:00.000Z")
  })
})
