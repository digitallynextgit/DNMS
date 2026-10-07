import { describe, expect, it } from "vitest"
import { daysFromToday, relativeDayLabel, todayKey } from "./relative-day"

// A fixed "now": 6 Oct 2026, mid-afternoon local time.
const NOW = new Date(2026, 9, 6, 15, 30)

describe("relative-day", () => {
  it("knows today in local terms", () => {
    expect(todayKey(NOW)).toBe("2026-10-06")
  })

  it("counts whole days, ignoring the time of day", () => {
    expect(daysFromToday("2026-10-06", NOW)).toBe(0)
    expect(daysFromToday("2026-10-07", NOW)).toBe(1)
    expect(daysFromToday("2026-10-05", NOW)).toBe(-1)
    expect(daysFromToday("2026-10-20T00:00:00.000Z", NOW)).toBe(14) // an ISO date works too
  })

  it("labels the way the tables read", () => {
    expect(relativeDayLabel("2026-10-06", NOW)).toBe("Today")
    expect(relativeDayLabel("2026-10-07", NOW)).toBe("Tomorrow")
    expect(relativeDayLabel("2026-10-20", NOW)).toBe("in 14 days")
    expect(relativeDayLabel("2027-01-26", NOW)).toBe("in 4 months")
    expect(relativeDayLabel("2026-08-15", NOW)).toBe("Passed")
  })
})
