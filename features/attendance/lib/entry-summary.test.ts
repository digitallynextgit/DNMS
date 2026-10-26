import { describe, expect, it } from "vitest"
import { buildEntrySummary, dueSlots, istClock, istMinutes, parseTimes } from "./entry-summary"

describe("entry summary times", () => {
  it("reads the configured times and falls back to the defaults", () => {
    expect(parseTimes("09:30,10:00")).toEqual(["09:30", "10:00"])
    expect(parseTimes(" 11:00, 10:00, 9:30 ")).toEqual(["09:30", "10:00", "11:00"])
    expect(parseTimes("nonsense")).toEqual(["09:30", "10:00", "11:00"])
    expect(parseTimes(undefined)).toEqual(["09:30", "10:00", "11:00"])
  })
  it("knows which slots have passed in India", () => {
    // 04:01 UTC is 09:31 IST.
    const now = new Date("2026-10-27T04:01:00.000Z")
    expect(istMinutes(now)).toBe(9 * 60 + 31)
    expect(dueSlots(["09:30", "10:00", "11:00"], istMinutes(now))).toEqual(["09:30"])
    expect(dueSlots(["09:30", "10:00", "11:00"], 11 * 60 + 5)).toEqual(["09:30", "10:00", "11:00"])
    expect(dueSlots(["09:30", "10:00"], 9 * 60)).toEqual([])
    expect(istClock(new Date("2026-10-27T03:32:00.000Z"))).toBe("9:02")
  })
})

describe("buildEntrySummary", () => {
  const people = [
    { name: "Priya", checkIn: "9:15", away: null },
    { name: "Aarav", checkIn: "9:02", away: null },
    { name: "Rahul", checkIn: null, away: null },
    { name: "Neha", checkIn: null, away: "leave" as const },
    { name: "Vikram", checkIn: null, away: "wfh" as const },
    { name: "Isha", checkIn: null, away: "half-day" as const },
  ]
  it("before office start, the missing are 'not yet'", () => {
    const s = buildEntrySummary("09:30", "10:00", people)
    expect(s.title).toBe("Entries at 09:30 · 2 in, 1 not yet")
    expect(s.message).toBe(
      [
        "In (2): Aarav 9:02, Priya 9:15",
        "Not in yet (1): Rahul",
        "WFH (1): Vikram",
        "On leave (1): Neha",
        "Half day (1): Isha",
      ].join("\n"),
    )
  })
  it("from office start, the missing are late", () => {
    const s = buildEntrySummary("10:00", "10:00", people)
    expect(s.title).toBe("Entries at 10:00 · 2 in, 1 late")
    expect(s.message).toContain("Not in by 10:00 (1): Rahul")
  })
  it("the last slot is the present / absent list", () => {
    const s = buildEntrySummary("11:00", "10:00", people, { final: true })
    expect(s.title).toBe("Attendance at 11:00 · 2 present, 1 absent")
    expect(s.message).toBe(
      [
        "Present (2): Aarav 9:02, Priya 9:15",
        "Absent (1): Rahul",
        "WFH (1): Vikram",
        "On leave (1): Neha",
        "Half day (1): Isha",
      ].join("\n"),
    )
  })
  it("on a weekend or holiday only says who came in", () => {
    const s = buildEntrySummary("10:00", "10:00", people, { offDay: "weekend" })
    expect(s.title).toBe("Entries at 10:00 (weekend) · 2 in")
    expect(s.message).toBe("In (2): Aarav 9:02, Priya 9:15")
  })
  it("says so when nobody is in", () => {
    expect(
      buildEntrySummary("09:30", "10:00", [{ name: "Rahul", checkIn: null, away: null }]).message,
    ).toBe("In: nobody yet\nNot in yet (1): Rahul")
  })
})
