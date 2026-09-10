import { describe, expect, it } from "vitest"

import {
  daysIn,
  formatPeriod,
  monthOf,
  parseDay,
  periodFor,
  presetPeriod,
  repeatPeriods,
  startOfWeek,
  weekOf,
  ymd,
} from "./delivery-period"

const day = (s: string) => new Date(`${s}T00:00:00.000Z`)
const span = (p: { start: Date; end: Date }) => `${ymd(p.start)}..${ymd(p.end)}`

describe("startOfWeek", () => {
  // 2026-09-09 is a Wednesday; the Monday of that week is the 7th.
  it("walks back to Monday from mid-week", () => {
    expect(ymd(startOfWeek(day("2026-09-09")))).toBe("2026-09-07")
  })

  it("leaves a Monday where it is", () => {
    expect(ymd(startOfWeek(day("2026-09-07")))).toBe("2026-09-07")
  })

  it("treats Sunday as belonging to the week that is finishing", () => {
    // Monday-start, so a Sunday belongs to the week just ending rather than
    // the one about to begin.
    expect(ymd(startOfWeek(day("2026-09-13")))).toBe("2026-09-07")
  })

  it("crosses a month boundary backwards", () => {
    expect(ymd(startOfWeek(day("2026-10-01")))).toBe("2026-09-28")
  })
})

describe("weekOf / monthOf", () => {
  it("gives the inclusive WORKING week, Mon-Fri", () => {
    expect(span(weekOf(day("2026-09-09")))).toBe("2026-09-07..2026-09-11")
    expect(daysIn(weekOf(day("2026-09-09")))).toBe(5)
  })

  it("reads a weekend date back as the week that just finished", () => {
    // Sat 12th and Sun 13th both belong to the Mon 7th - Fri 11th week; no
    // period covers them, which is what "we do not plan the weekend" means.
    expect(span(weekOf(day("2026-09-12")))).toBe("2026-09-07..2026-09-11")
    expect(span(weekOf(day("2026-09-13")))).toBe("2026-09-07..2026-09-11")
  })

  it("gives the whole calendar month", () => {
    expect(span(monthOf(day("2026-09-09")))).toBe("2026-09-01..2026-09-30")
    expect(span(monthOf(day("2026-02-15")))).toBe("2026-02-01..2026-02-28")
  })

  it("handles a leap February", () => {
    expect(span(monthOf(day("2028-02-15")))).toBe("2028-02-01..2028-02-29")
    expect(daysIn(monthOf(day("2028-02-15")))).toBe(29)
  })
})

describe("periodFor", () => {
  it("a single day is start === end", () => {
    expect(span(periodFor("day", day("2026-09-09")))).toBe("2026-09-09..2026-09-09")
    expect(daysIn(periodFor("day", day("2026-09-09")))).toBe(1)
  })

  it("reads a backwards range the way round it was meant", () => {
    expect(span(periodFor("range", day("2026-09-20"), day("2026-09-10")))).toBe(
      "2026-09-10..2026-09-20",
    )
  })

  it("a range with no end is that one day", () => {
    expect(span(periodFor("range", day("2026-09-10"), null))).toBe("2026-09-10..2026-09-10")
  })
})

describe("repeatPeriods", () => {
  it("lays down consecutive working weeks, a week apart", () => {
    const out = repeatPeriods("week", day("2026-09-09"), 3).map(span)
    // Each starts 7 days after the last, so the weekend sits BETWEEN them.
    // Stepping from Friday+1 would have landed back on the same week.
    expect(out).toEqual([
      "2026-09-07..2026-09-11",
      "2026-09-14..2026-09-18",
      "2026-09-21..2026-09-25",
    ])
  })

  it("steps months of different lengths without drifting", () => {
    const out = repeatPeriods("month", day("2026-01-15"), 4).map(span)
    expect(out).toEqual([
      "2026-01-01..2026-01-31",
      "2026-02-01..2026-02-28",
      "2026-03-01..2026-03-31",
      "2026-04-01..2026-04-30",
    ])
  })

  it("repeats a custom range by its own width", () => {
    // A 10-day range repeats as 10-day blocks, back to back.
    const out = repeatPeriods("range", day("2026-09-01"), 3)
    expect(out.map(daysIn)).toEqual([1, 1, 1]) // no `until` given: one-day blocks
    const wide = repeatPeriods("range", day("2026-09-01"), 1)
    expect(daysIn(wide[0]!)).toBe(1)
  })

  it("always returns at least one period", () => {
    expect(repeatPeriods("week", day("2026-09-09"), 0)).toHaveLength(1)
    expect(repeatPeriods("week", day("2026-09-09"), -3)).toHaveLength(1)
  })

  it("does not mutate the anchor", () => {
    const anchor = day("2026-09-09")
    repeatPeriods("month", anchor, 5)
    expect(ymd(anchor)).toBe("2026-09-09")
  })
})

describe("formatPeriod", () => {
  const f = (a: string, b: string) => formatPeriod(day(a), day(b))

  it("names a single day", () => {
    expect(f("2026-09-09", "2026-09-09")).toBe("9 Sep 2026")
  })

  it("collapses a range inside one month", () => {
    expect(f("2026-09-07", "2026-09-13")).toBe("7-13 Sep 2026")
  })

  it("names a whole calendar month instead of spanning it", () => {
    expect(f("2026-09-01", "2026-09-30")).toBe("Sep 2026")
    expect(f("2028-02-01", "2028-02-29")).toBe("Feb 2028")
  })

  it("does NOT name a month it only nearly covers", () => {
    expect(f("2026-09-01", "2026-09-29")).toBe("1-29 Sep 2026")
  })

  it("spans two months in one year", () => {
    expect(f("2026-09-28", "2026-10-04")).toBe("28 Sep - 4 Oct 2026")
  })

  it("spells out both years when it crosses one", () => {
    expect(f("2026-12-28", "2027-01-03")).toBe("28 Dec 2026 - 3 Jan 2027")
  })
})

describe("presetPeriod", () => {
  const today = day("2026-09-09") // a Wednesday

  it("this week and next week are consecutive", () => {
    expect(span(presetPeriod("week", 0, today))).toBe("2026-09-07..2026-09-11")
    expect(span(presetPeriod("week", 1, today))).toBe("2026-09-14..2026-09-18")
  })

  it("this month and next month", () => {
    expect(span(presetPeriod("month", 0, today))).toBe("2026-09-01..2026-09-30")
    expect(span(presetPeriod("month", 1, today))).toBe("2026-10-01..2026-10-31")
  })

  it("rolls the year over for a December anchor", () => {
    expect(span(presetPeriod("month", 1, day("2026-12-05")))).toBe("2027-01-01..2027-01-31")
  })
})

describe("parseDay", () => {
  it("takes yyyy-MM-dd at UTC midnight", () => {
    expect(parseDay("2026-09-09")?.toISOString()).toBe("2026-09-09T00:00:00.000Z")
  })

  it("refuses anything else", () => {
    for (const bad of ["", null, undefined, "09/09/2026", "2026-9-9", "not a date"]) {
      expect(parseDay(bad)).toBeNull()
    }
  })
})
