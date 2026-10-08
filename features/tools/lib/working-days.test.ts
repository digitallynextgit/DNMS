import { describe, expect, it } from "vitest"
import { workingDaysBetween } from "@/lib/dates"
import {
  MAX_ADD_WORKING_DAYS,
  MAX_RANGE_DAYS,
  addWorkingDays,
  buildHolidayMap,
  checkRange,
  countWorkingDays,
  floatingHolidaysBetween,
  formatYmd,
  parseYmd,
  shiftYmd,
  yearsBetween,
  yearsForAdd,
  type HolidayInput,
} from "./working-days"

// October 2026: Thu 1, Fri 2, Sat 3, Sun 4, Mon 5 ... Fri 9, Sat 10, Sun 11, Mon 12.
const HOLIDAYS: HolidayInput[] = [
  { date: "2026-10-02T00:00:00.000Z", name: "Gandhi Jayanti", isOptional: false },
  { date: "2026-11-07T00:00:00.000Z", name: "Saturday Festival", isOptional: false }, // a Saturday
  { date: "2026-10-06", name: "Floating Day", isOptional: true }, // a Tuesday
  { date: "2027-01-01T00:00:00.000Z", name: "New Year", isOptional: false }, // a Friday
]
const FIXED = buildHolidayMap(HOLIDAYS, { includeFloating: false })
const ALL = buildHolidayMap(HOLIDAYS, { includeFloating: true })
const NONE = new Map<string, string[]>()

describe("parseYmd / formatYmd", () => {
  it("reads real dates as UTC midnight", () => {
    expect(parseYmd("2026-10-08")?.toISOString()).toBe("2026-10-08T00:00:00.000Z")
  })

  it("rejects anything that isn't a real yyyy-MM-dd date", () => {
    expect(parseYmd("")).toBeNull()
    expect(parseYmd(undefined)).toBeNull()
    expect(parseYmd("2026-02-30")).toBeNull()
    expect(parseYmd("8/10/2026")).toBeNull()
  })

  it("formats without a timezone shift", () => {
    expect(formatYmd("2026-10-08")).toBe("Thu, 8 Oct 2026")
    expect(formatYmd("2027-01-01", "d MMM")).toBe("1 Jan")
  })
})

describe("buildHolidayMap", () => {
  it("keeps fixed holidays and leaves floating ones out by default", () => {
    expect([...FIXED.keys()].sort()).toEqual(["2026-10-02", "2026-11-07", "2027-01-01"])
    expect(ALL.get("2026-10-06")).toEqual(["Floating Day"])
  })

  it("puts two holidays on the same day together, without repeats", () => {
    const map = buildHolidayMap(
      [
        { date: "2026-10-20", name: "Diwali", isOptional: false },
        { date: "2026-10-20T00:00:00.000Z", name: "Diwali", isOptional: false },
        { date: "2026-10-20", name: "Kali Puja", isOptional: false },
      ],
      { includeFloating: false },
    )
    expect(map.get("2026-10-20")).toEqual(["Diwali", "Kali Puja"])
  })
})

describe("checkRange", () => {
  it("needs both dates, real ones, in order", () => {
    expect(checkRange("", "2026-10-08")).toBe("missing")
    expect(checkRange("2026-10-08", "2026-02-30")).toBe("invalid")
    expect(checkRange("2026-10-08", "2026-10-07")).toBe("end-before-start")
    expect(checkRange("2026-10-08", "2026-10-08")).toBeNull()
  })

  it("stops at about three years", () => {
    expect(checkRange("2026-01-01", "2027-12-31")).toBeNull() // 2 years is fine
    expect(checkRange("2026-01-01", "2030-01-01")).toBe("too-long")
    expect(MAX_RANGE_DAYS).toBeGreaterThan(2 * 366)
  })
})

describe("countWorkingDays", () => {
  it("counts a plain Monday-to-Friday week", () => {
    const r = countWorkingDays("2026-10-05", "2026-10-09", NONE, { includeEnd: true })
    expect(r.workingDays).toBe(5)
    expect(r.calendarDays).toBe(5)
    expect(r.skipped).toEqual([])
  })

  it("skips Saturdays and Sundays", () => {
    const r = countWorkingDays("2026-10-05", "2026-10-11", NONE, { includeEnd: true })
    expect(r.workingDays).toBe(5)
    expect(r.weekendDays).toBe(2)
    expect(r.skipped.map((s) => s.date)).toEqual(["2026-10-10", "2026-10-11"])
  })

  it("leaves the end date out when asked", () => {
    const r = countWorkingDays("2026-10-05", "2026-10-12", NONE, { includeEnd: false })
    expect(r.workingDays).toBe(5)
    expect(r.calendarDays).toBe(7)
  })

  it("handles start = end", () => {
    expect(
      countWorkingDays("2026-10-08", "2026-10-08", NONE, { includeEnd: true }).workingDays,
    ).toBe(1)
    const excluded = countWorkingDays("2026-10-08", "2026-10-08", NONE, { includeEnd: false })
    expect(excluded.workingDays).toBe(0)
    expect(excluded.calendarDays).toBe(0)
    const saturday = countWorkingDays("2026-10-03", "2026-10-03", NONE, { includeEnd: true })
    expect(saturday.workingDays).toBe(0)
    expect(saturday.weekendDays).toBe(1)
  })

  it("skips a weekday holiday and names it", () => {
    const r = countWorkingDays("2026-10-01", "2026-10-05", FIXED, { includeEnd: true })
    expect(r.workingDays).toBe(2) // Thu 1 and Mon 5
    expect(r.holidayDays).toBe(1)
    expect(r.skipped[0]).toEqual({
      date: "2026-10-02",
      reason: "holiday",
      names: ["Gandhi Jayanti"],
    })
  })

  it("doesn't count a holiday on a weekend twice", () => {
    const r = countWorkingDays("2026-11-02", "2026-11-08", FIXED, { includeEnd: true })
    expect(r.workingDays).toBe(5)
    expect(r.weekendDays).toBe(2)
    expect(r.holidayDays).toBe(0)
    expect(r.skipped[0]).toEqual({
      date: "2026-11-07",
      reason: "weekend",
      names: ["Saturday Festival"],
    })
  })

  it("only skips floating holidays when asked", () => {
    const week = ["2026-10-05", "2026-10-09"] as const
    expect(countWorkingDays(...week, FIXED, { includeEnd: true }).workingDays).toBe(5)
    expect(countWorkingDays(...week, ALL, { includeEnd: true }).workingDays).toBe(4)
  })

  it("crosses into a new year", () => {
    const r = countWorkingDays("2026-12-31", "2027-01-04", FIXED, { includeEnd: true })
    expect(r.workingDays).toBe(2) // Thu 31 Dec and Mon 4 Jan
    expect(r.skipped.map((s) => [s.date, s.reason])).toEqual([
      ["2027-01-01", "holiday"],
      ["2027-01-02", "weekend"],
      ["2027-01-03", "weekend"],
    ])
  })

  it("agrees with the app's own workingDaysBetween over two years", () => {
    const holidays = new Set(FIXED.keys())
    const r = countWorkingDays("2026-01-01", "2027-12-31", FIXED, { includeEnd: true })
    const app = workingDaysBetween(parseYmd("2026-01-01")!, parseYmd("2027-12-31")!, holidays)
    expect(r.workingDays).toBe(app.length)
    expect(r.calendarDays).toBe(730)
  })

  it("refuses a range checkRange rejects", () => {
    expect(() => countWorkingDays("2026-10-09", "2026-10-05", NONE, { includeEnd: true })).toThrow()
  })
})

describe("addWorkingDays", () => {
  it("returns the start date for 0 days", () => {
    const r = addWorkingDays("2026-10-03", 0, FIXED, { countStart: false })
    expect(r.end).toBe("2026-10-03")
    expect(r.skipped).toEqual([])
    expect(r.calendarDays).toBe(0)
  })

  it("counts from the day after the start by default", () => {
    expect(addWorkingDays("2026-10-05", 1, NONE, { countStart: false }).end).toBe("2026-10-06")
    const fri = addWorkingDays("2026-10-09", 1, NONE, { countStart: false })
    expect(fri.end).toBe("2026-10-12")
    expect(fri.weekendDays).toBe(2)
    expect(fri.calendarDays).toBe(3) // Sat, Sun, Mon
  })

  it("can count the start date as day 1", () => {
    const week = addWorkingDays("2026-10-05", 5, NONE, { countStart: true })
    expect(week.end).toBe("2026-10-09")
    expect(week.calendarDays).toBe(5)
    // A Saturday start: the first working day is Monday.
    expect(addWorkingDays("2026-10-03", 1, NONE, { countStart: true }).end).toBe("2026-10-05")
  })

  it("skips holidays", () => {
    const r = addWorkingDays("2026-10-01", 1, FIXED, { countStart: false })
    expect(r.end).toBe("2026-10-05")
    expect(r.holidayDays).toBe(1)
    expect(r.weekendDays).toBe(2)
  })

  it("crosses into a new year", () => {
    expect(addWorkingDays("2026-12-31", 1, FIXED, { countStart: false }).end).toBe("2027-01-04")
  })

  it("only takes whole numbers in range", () => {
    expect(() => addWorkingDays("2026-10-05", -1, NONE, { countStart: false })).toThrow()
    expect(() => addWorkingDays("2026-10-05", 1.5, NONE, { countStart: false })).toThrow()
    expect(() =>
      addWorkingDays("2026-10-05", MAX_ADD_WORKING_DAYS + 1, NONE, { countStart: false }),
    ).toThrow()
    expect(() => addWorkingDays("nope", 1, NONE, { countStart: false })).toThrow()
  })
})

describe("years to load", () => {
  it("lists every year a range touches", () => {
    expect(yearsBetween("2026-12-31", "2028-01-01")).toEqual([2026, 2027, 2028])
    expect(yearsBetween("2026-10-09", "2026-10-05")).toEqual([])
  })

  it("looks ahead far enough for holidays to push a deadline out", () => {
    expect(yearsForAdd("2026-10-08", 10, false)).toEqual([2026])
    expect(yearsForAdd("2026-12-01", 10, false)).toEqual([2026, 2027])
    expect(yearsForAdd("2026-10-08", -1, false)).toEqual([])
  })
})

describe("floatingHolidaysBetween", () => {
  it("lists the weekday floating holidays in a range", () => {
    expect(floatingHolidaysBetween(HOLIDAYS, "2026-10-01", "2026-10-31")).toEqual([
      { date: "2026-10-06", name: "Floating Day" },
    ])
    expect(floatingHolidaysBetween(HOLIDAYS, "2026-10-07", "2026-10-31")).toEqual([])
    const onSunday = [{ date: "2026-10-04", name: "Sunday Fest", isOptional: true }]
    expect(floatingHolidaysBetween(onSunday, "2026-10-01", "2026-10-31")).toEqual([])
  })
})

describe("shiftYmd", () => {
  it("moves a day across month and year ends", () => {
    expect(shiftYmd("2026-12-31", 1)).toBe("2027-01-01")
    expect(shiftYmd("2026-03-01", -1)).toBe("2026-02-28")
  })
})
