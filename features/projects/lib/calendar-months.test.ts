import { describe, expect, it } from "vitest"

import {
  dueLabel,
  dueTone,
  editionIndexForMonth,
  formatDueDate,
  formatMonth,
  formatMonthShort,
  groupIntoSeries,
  monthISO,
  parseMonth,
  shiftMonth,
  stepEdition,
  type CalendarEdition,
} from "./calendar-months"

const ed = (id: string, name: string, periodMonth: string | null): CalendarEdition => ({
  id,
  name,
  periodMonth,
})

describe("parseMonth", () => {
  it("reads the first of a month", () => {
    expect(parseMonth("2026-09-01")).toEqual({ year: 2026, month0: 8 })
  })

  it("reads a month that arrived as a timestamp", () => {
    // JSON.stringify turns a Date into this, and a payload that took that route
    // must not read as undated.
    expect(parseMonth("2026-09-01T00:00:00.000Z")).toEqual({ year: 2026, month0: 8 })
  })

  it("treats null, empty and nonsense as no month", () => {
    expect(parseMonth(null)).toBeNull()
    expect(parseMonth("")).toBeNull()
    expect(parseMonth("September")).toBeNull()
    expect(parseMonth("2026-13-01")).toBeNull()
  })

  it("does not shift the month by timezone", () => {
    // The bug this file exists to avoid: new Date("2026-09-01").getMonth() is
    // August anywhere west of Greenwich, because the string parses as UTC
    // midnight and getMonth() reads local time.
    expect(parseMonth("2026-01-01")).toEqual({ year: 2026, month0: 0 })
    expect(parseMonth("2026-12-01")).toEqual({ year: 2026, month0: 11 })
  })
})

describe("monthISO", () => {
  it("pins to the first of the month and pads", () => {
    expect(monthISO(2026, 8)).toBe("2026-09-01")
    expect(monthISO(2026, 0)).toBe("2026-01-01")
  })

  it("round-trips with parseMonth", () => {
    for (let m = 0; m < 12; m++) {
      expect(parseMonth(monthISO(2026, m))).toEqual({ year: 2026, month0: m })
    }
  })
})

describe("formatMonth", () => {
  it("names the month", () => {
    expect(formatMonth("2026-09-01")).toBe("September 2026")
    expect(formatMonthShort("2026-09-01")).toBe("Sep 2026")
  })

  it("says so when there is no month", () => {
    expect(formatMonth(null)).toBe("No month")
    expect(formatMonthShort(null)).toBe("No month")
  })
})

describe("shiftMonth", () => {
  it("rolls over the year boundary in both directions", () => {
    expect(shiftMonth({ year: 2026, month0: 11 }, 1)).toEqual({ year: 2027, month0: 0 })
    expect(shiftMonth({ year: 2026, month0: 0 }, -1)).toEqual({ year: 2025, month0: 11 })
  })

  it("handles a shift of more than a year", () => {
    expect(shiftMonth({ year: 2026, month0: 5 }, 14)).toEqual({ year: 2027, month0: 7 })
    expect(shiftMonth({ year: 2026, month0: 5 }, -14)).toEqual({ year: 2025, month0: 3 })
  })
})

describe("groupIntoSeries", () => {
  const rows = [
    ed("a", "Performance", "2026-08-01"),
    ed("b", "Content", "2026-09-01"),
    ed("c", "Performance", "2026-09-01"),
    ed("d", "Performance", null),
    ed("e", "Performance", "2026-07-01"),
  ]

  it("makes one entry per name, sorted by name", () => {
    expect(groupIntoSeries(rows).map((s) => s.name)).toEqual(["Content", "Performance"])
  })

  it("orders a series newest month first, undated last", () => {
    const perf = groupIntoSeries(rows).find((s) => s.name === "Performance")!
    expect(perf.editions.map((e) => e.id)).toEqual(["c", "a", "e", "d"])
  })

  it("returns nothing for no rows", () => {
    expect(groupIntoSeries([])).toEqual([])
  })
})

describe("editionIndexForMonth", () => {
  const series = groupIntoSeries([
    ed("sep", "Performance", "2026-09-01"),
    ed("aug", "Performance", "2026-08-01"),
    ed("none", "Performance", null),
  ])[0]!

  it("finds the edition for a month", () => {
    expect(editionIndexForMonth(series, { year: 2026, month0: 8 })).toBe(0)
    expect(editionIndexForMonth(series, { year: 2026, month0: 7 })).toBe(1)
  })

  it("reports a month with no edition", () => {
    expect(editionIndexForMonth(series, { year: 2026, month0: 9 })).toBe(-1)
  })

  it("finds the undated edition when asked for no month", () => {
    expect(editionIndexForMonth(series, null)).toBe(2)
  })

  it("is -1 with no series at all", () => {
    expect(editionIndexForMonth(null, { year: 2026, month0: 8 })).toBe(-1)
  })
})

describe("stepEdition", () => {
  // August and October exist; SEPTEMBER DOES NOT. The gap is the interesting
  // case: stepping walks the months the calendar actually has, not the
  // calendar year, so it must not stall on a month nobody ran.
  const series = groupIntoSeries([
    ed("oct", "Performance", "2026-10-01"),
    ed("aug", "Performance", "2026-08-01"),
    ed("jun", "Performance", "2026-06-01"),
    ed("none", "Performance", null),
  ])[0]!

  it("steps back to the previous edition that exists, skipping the gap", () => {
    expect(stepEdition(series, { year: 2026, month0: 9 }, -1)?.id).toBe("aug")
  })

  it("steps forward the same way", () => {
    expect(stepEdition(series, { year: 2026, month0: 7 }, 1)?.id).toBe("oct")
  })

  it("stops at the ends", () => {
    expect(stepEdition(series, { year: 2026, month0: 9 }, 1)).toBeNull()
    expect(stepEdition(series, { year: 2026, month0: 5 }, -1)).toBeNull()
  })

  it("never steps onto an undated edition", () => {
    // June is the oldest DATED edition; the undated one is not part of any
    // month order, so stepping back from it is the end of the road.
    expect(stepEdition(series, { year: 2026, month0: 5 }, -1)).toBeNull()
  })

  it("goes nowhere from a month that has no edition", () => {
    expect(stepEdition(series, { year: 2026, month0: 8 }, -1)).toBeNull()
  })
})

describe("dueTone", () => {
  const TODAY = "2026-09-15"
  const SEP = "2026-09-01"

  it("has no tone without a date", () => {
    expect(dueTone(null, SEP, TODAY)).toBe("none")
  })

  it("flags a date already gone", () => {
    expect(dueTone("2026-09-13", SEP, TODAY)).toBe("overdue")
  })

  it("separates today, the next few days, and later", () => {
    expect(dueTone("2026-09-15", SEP, TODAY)).toBe("today")
    expect(dueTone("2026-09-18", SEP, TODAY)).toBe("soon")
    expect(dueTone("2026-09-30", SEP, TODAY)).toBe("later")
  })

  it("does not raise an alarm about a month that has already ended", () => {
    // The whole reason dueTone takes the calendar's month: browsing back to
    // June would otherwise paint every chip red forever.
    expect(dueTone("2026-06-10", "2026-06-01", TODAY)).toBe("later")
  })

  it("still raises one for an earlier day of the CURRENT month", () => {
    expect(dueTone("2026-09-02", SEP, TODAY)).toBe("overdue")
  })

  it("treats an undated calendar as live, since it has no month to be over", () => {
    expect(dueTone("2026-09-13", null, TODAY)).toBe("overdue")
  })
})

describe("dueLabel", () => {
  const TODAY = "2026-09-15"

  it("counts the days while it is recent", () => {
    expect(dueLabel("2026-09-13", "overdue", TODAY)).toBe("Overdue 2 days")
    expect(dueLabel("2026-09-14", "overdue", TODAY)).toBe("Overdue 1 day")
  })

  it("switches to the date once the count stops meaning anything", () => {
    expect(dueLabel("2026-09-01", "overdue", TODAY)).toBe("Overdue since 1 Sep")
  })

  it("says the plain thing otherwise", () => {
    expect(dueLabel("2026-09-15", "today", TODAY)).toBe("Due today")
    expect(dueLabel("2026-09-30", "later", TODAY)).toBe("Due 30 Sep")
    expect(dueLabel(null, "none", TODAY)).toBe("No date")
  })

  it("shows the year only when it is not this one", () => {
    expect(formatDueDate("2026-09-30", "2026-01-01")).toBe("30 Sep")
    expect(formatDueDate("2027-01-04", "2026-01-01")).toBe("4 Jan 2027")
  })
})
