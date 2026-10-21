import { describe, expect, it } from "vitest"

import {
  copyPlanWindows,
  elapsedShare,
  isWeekWindow,
  monthPeriod,
  shiftPlanWindow,
  weeksOfMonth,
} from "./goal-periods"

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
const iso = (p: { start: Date; end: Date } | null) =>
  p ? `${p.start.toISOString().slice(0, 10)}..${p.end.toISOString().slice(0, 10)}` : null

describe("monthPeriod", () => {
  it("covers the calendar month", () => {
    expect(iso(monthPeriod("2026-02"))).toBe("2026-02-01..2026-02-28")
    expect(iso(monthPeriod("2026-10-01"))).toBe("2026-10-01..2026-10-31")
    expect(monthPeriod("Oct")).toBeNull()
  })
})

describe("elapsedShare", () => {
  const oct = monthPeriod("2026-10")!
  it("counts today as worked", () => {
    expect(elapsedShare(oct.start, oct.end, d("2026-10-01"))).toBeCloseTo(1 / 31)
    expect(elapsedShare(oct.start, oct.end, d("2026-10-31"))).toBe(1)
  })
  it("is 0 before and 1 after", () => {
    expect(elapsedShare(oct.start, oct.end, d("2026-09-20"))).toBe(0)
    expect(elapsedShare(oct.start, oct.end, d("2026-11-05"))).toBe(1)
  })
})

describe("shiftPlanWindow", () => {
  const oct = monthPeriod("2026-10")!
  const nov = monthPeriod("2026-11")!
  const shift = (a: string, b: string) => iso(shiftPlanWindow({ start: d(a), end: d(b) }, oct, nov))

  it("keeps a whole-month plan whole", () => {
    expect(shift("2026-10-01", "2026-10-31")).toBe("2026-11-01..2026-11-30")
  })
  it("moves a Monday-Friday week to the Monday of its new week", () => {
    // 5 Oct + one month = 5 Nov (Thu) -> week of Mon 2 Nov.
    expect(shift("2026-10-05", "2026-10-09")).toBe("2026-11-02..2026-11-06")
    expect(shift("2026-10-26", "2026-10-30")).toBe("2026-11-23..2026-11-27")
  })
  it("keeps weeks apart, so none collide", () => {
    const weeks = ["05", "12", "19", "26"].map((day) =>
      shift(`2026-10-${day}`, `2026-10-${String(Number(day) + 4).padStart(2, "0")}`),
    )
    expect(new Set(weeks).size).toBe(4)
  })
  it("keeps a free range's day and length", () => {
    expect(shift("2026-10-10", "2026-10-20")).toBe("2026-11-10..2026-11-20")
  })
  it("drops a window that lands wholly outside the new month", () => {
    // Wk of 28 Sep (planned for October's first days) lands on 26-30 Oct: all October.
    expect(shift("2026-09-28", "2026-10-02")).toBeNull()
    expect(
      iso(
        shiftPlanWindow(
          { start: d("2026-01-31"), end: d("2026-01-31") },
          monthPeriod("2026-01")!,
          monthPeriod("2026-02")!,
        ),
      ),
    ).toBeNull()
  })
})

describe("weeksOfMonth", () => {
  const starts = (ym: string) =>
    weeksOfMonth(monthPeriod(ym)!).map((w) => w.start.toISOString().slice(0, 10))

  it("takes every Monday-Friday week whose Thursday is in the month", () => {
    // 1 Oct 2026 is a Thursday, so the week of 28 Sep is October's.
    expect(starts("2026-10")).toEqual([
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ])
    expect(starts("2026-11")).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"])
    expect(starts("2026-12")).toEqual([
      "2026-11-30",
      "2026-12-07",
      "2026-12-14",
      "2026-12-21",
      "2026-12-28",
    ])
  })

  it("never gives one week to two months", () => {
    const nov = starts("2026-11")
    expect(starts("2026-12").some((w) => nov.includes(w))).toBe(false)
    expect(isWeekWindow({ start: d("2026-11-30"), end: d("2026-12-04") })).toBe(true)
    expect(isWeekWindow({ start: d("2026-11-30"), end: d("2026-12-06") })).toBe(false)
  })
})

describe("copyPlanWindows", () => {
  const oct = monthPeriod("2026-10")!
  const nov = monthPeriod("2026-11")!
  const dec = monthPeriod("2026-12")!
  const copy = (a: string, b: string, from = nov, to = dec) =>
    copyPlanWindows({ start: d(a), end: d(b) }, from, to).map(
      (w) => `${w.start.toISOString().slice(0, 10)}..${w.end.toISOString().slice(0, 10)}`,
    )

  it("fills a 5-week month from a 4-week one: the last week also covers the extra week", () => {
    expect(copy("2026-11-02", "2026-11-06")).toEqual(["2026-11-30..2026-12-04"])
    expect(copy("2026-11-23", "2026-11-27")).toEqual([
      "2026-12-21..2026-12-25",
      "2026-12-28..2027-01-01",
    ])
    // Every week of December gets work from a plan that covered every week of November.
    const all = ["02", "09", "16", "23"].flatMap((day) =>
      copy(`2026-11-${day}`, `2026-11-${String(Number(day) + 4).padStart(2, "0")}`),
    )
    expect(all).toHaveLength(5)
  })

  it("leaves out a longer month's extra week", () => {
    expect(copy("2026-10-26", "2026-10-30", oct, nov)).toEqual([])
    expect(copy("2026-09-28", "2026-10-02", oct, nov)).toEqual(["2026-11-02..2026-11-06"])
  })

  it("keeps the whole month whole and moves other ranges by day", () => {
    expect(copy("2026-11-01", "2026-11-30")).toEqual(["2026-12-01..2026-12-31"])
    expect(copy("2026-11-10", "2026-11-20")).toEqual(["2026-12-10..2026-12-20"])
  })
})
