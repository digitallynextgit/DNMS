import { describe, expect, it } from "vitest"
import {
  dayDiff,
  formatClock,
  formatDay,
  formatOffset,
  parseDate,
  parseSavedZones,
  parseTime,
  planDay,
  runs,
  sameZone,
  searchZones,
  shortClock,
  wallTimeIn,
  wallTimeToInstant,
  zoneInfo,
  zoneOffsetMinutes,
  zoneKey,
} from "./time-zones"

describe("formatOffset", () => {
  it("writes offsets the short way", () => {
    expect(formatOffset(330)).toBe("GMT+5:30")
    expect(formatOffset(345)).toBe("GMT+5:45")
    expect(formatOffset(-240)).toBe("GMT-4")
    expect(formatOffset(-570)).toBe("GMT-9:30")
    expect(formatOffset(0)).toBe("GMT")
  })
})

describe("zoneOffsetMinutes", () => {
  it("knows India never changes its clocks", () => {
    expect(zoneOffsetMinutes("Asia/Kolkata", Date.UTC(2026, 0, 15))).toBe(330)
    expect(zoneOffsetMinutes("Asia/Kolkata", Date.UTC(2026, 6, 15))).toBe(330)
  })

  it("follows daylight saving in New York and London", () => {
    // US clocks go forward on Sunday 8 March 2026.
    expect(zoneOffsetMinutes("America/New_York", Date.UTC(2026, 2, 7, 12))).toBe(-300)
    expect(zoneOffsetMinutes("America/New_York", Date.UTC(2026, 2, 9, 12))).toBe(-240)
    expect(zoneOffsetMinutes("Europe/London", Date.UTC(2026, 0, 15))).toBe(0)
    expect(zoneOffsetMinutes("Europe/London", Date.UTC(2026, 6, 15))).toBe(60)
  })
})

describe("converting a wall time", () => {
  it("3 PM in London is 8:30 PM in India in winter and 7:30 PM in summer", () => {
    const winter = wallTimeToInstant(
      { year: 2026, month: 1, day: 15, hour: 15, minute: 0 },
      "Europe/London",
    )
    expect(winter).toBe(Date.UTC(2026, 0, 15, 15, 0))
    expect(wallTimeIn("Asia/Kolkata", winter)).toMatchObject({ hour: 20, minute: 30, day: 15 })

    const summer = wallTimeToInstant(
      { year: 2026, month: 7, day: 1, hour: 15, minute: 0 },
      "Europe/London",
    )
    expect(summer).toBe(Date.UTC(2026, 6, 1, 14, 0))
    expect(wallTimeIn("Asia/Kolkata", summer)).toMatchObject({ hour: 19, minute: 30 })
  })

  it("moves across the date line", () => {
    // 9 AM Monday in Sydney is still Sunday evening in New York.
    const t = wallTimeToInstant(
      { year: 2026, month: 10, day: 12, hour: 9, minute: 0 },
      "Australia/Sydney",
    )
    const ny = wallTimeIn("America/New_York", t)
    expect(ny).toMatchObject({ day: 11, hour: 18, minute: 0 })
    expect(dayDiff({ year: 2026, month: 10, day: 12 }, ny)).toBe(-1)
  })

  it("handles the day the clocks go forward", () => {
    const before = wallTimeToInstant(
      { year: 2026, month: 3, day: 6, hour: 9, minute: 0 },
      "America/New_York",
    )
    const after = wallTimeToInstant(
      { year: 2026, month: 3, day: 9, hour: 9, minute: 0 },
      "America/New_York",
    )
    expect(wallTimeIn("Asia/Kolkata", before)).toMatchObject({ hour: 19, minute: 30 })
    expect(wallTimeIn("Asia/Kolkata", after)).toMatchObject({ hour: 18, minute: 30 })
    // 2:30 AM never happens that night - it is treated as 3:30 AM.
    const gap = wallTimeToInstant(
      { year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
      "America/New_York",
    )
    expect(gap).toBe(Date.UTC(2026, 2, 8, 7, 30))
  })

  it("picks the first of a time that happens twice when clocks go back", () => {
    const t = wallTimeToInstant(
      { year: 2026, month: 10, day: 25, hour: 1, minute: 30 },
      "Europe/London",
    )
    expect(t).toBe(Date.UTC(2026, 9, 25, 0, 30))
  })
})

describe("text helpers", () => {
  it("reads and writes dates and times", () => {
    expect(parseDate("2026-10-08")).toEqual({ year: 2026, month: 10, day: 8 })
    expect(parseDate("2026-02-30")).toBeNull()
    expect(parseTime("09:05")).toEqual({ hour: 9, minute: 5 })
    expect(parseTime("24:00")).toBeNull()
  })

  it("formats clocks and days the same in every browser", () => {
    expect(formatClock({ hour: 0, minute: 5 })).toBe("12:05 AM")
    expect(formatClock({ hour: 15, minute: 0 })).toBe("3:00 PM")
    expect(formatDay({ year: 2026, month: 10, day: 9 })).toBe("Fri 9 Oct")
    expect(shortClock(0)).toBe("12am")
    expect(shortClock(540)).toBe("9am")
    expect(shortClock(720)).toBe("12pm")
    expect(shortClock(1050)).toBe("5:30pm")
  })
})

describe("zone names", () => {
  it("treats old and new names as the same place", () => {
    expect(sameZone("Asia/Calcutta", "Asia/Kolkata")).toBe(true)
    expect(zoneKey("Europe/Kiev")).toBe("Europe/Kyiv")
    expect(zoneInfo("Asia/Calcutta")).toEqual({ city: "Kolkata", country: "India" })
    expect(zoneInfo("America/Port_of_Spain").city).toBe("Port of Spain")
  })

  it("finds places by city, country or nickname", () => {
    expect(zoneKey(searchZones("lond")[0]?.zone ?? "")).toBe("Europe/London")
    expect(searchZones("mumbai").map((z) => zoneKey(z.zone))).toContain("Asia/Kolkata")
    expect(searchZones("uae").map((z) => z.zone)).toContain("Asia/Dubai")
    expect(searchZones("sao paulo")[0]?.city).toBe("São Paulo")
    expect(searchZones("   ")).toEqual([])
  })

  it("keeps only real, distinct zones from storage", () => {
    expect(
      parseSavedZones('["Europe/London","Not/AZone","Europe/London","Asia/Calcutta"]'),
    ).toEqual(["Europe/London", "Asia/Calcutta"])
    expect(parseSavedZones("not json")).toBeNull()
    expect(parseSavedZones('{"a":1}')).toBeNull()
    expect(parseSavedZones(null)).toBeNull()
  })
})

describe("planDay", () => {
  it("finds the hours that are inside 9 AM-6 PM in both India and London", () => {
    const plan = planDay({ year: 2026, month: 1, day: 15 }, "Asia/Kolkata", [
      "Asia/Kolkata",
      "Europe/London",
    ])
    expect(plan.hours).toHaveLength(24)
    expect(plan.hours[0]).toBe(Date.UTC(2026, 0, 14, 18, 30)) // midnight IST
    // 3, 4 and 5 PM in India = 9:30, 10:30 and 11:30 AM in London.
    expect(runs(plan.everyone)).toEqual([[15, 17]])
    expect(plan.rows[1]?.[15]?.minutes).toBe(9 * 60 + 30)
  })

  it("finds nothing when no hour works for everyone", () => {
    const plan = planDay({ year: 2026, month: 1, day: 15 }, "Asia/Kolkata", [
      "Asia/Kolkata",
      "America/Los_Angeles",
    ])
    expect(runs(plan.everyone)).toEqual([])
  })
})
