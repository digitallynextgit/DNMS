import { describe, expect, it } from "vitest"

import {
  attendanceWindow,
  computeTaskHours,
  defaultWindow,
  istDayKey,
  istInstant,
  splitOverlaps,
  type ClockPeriod,
  type DayWindow,
} from "./work-hours"

const ist = (day: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number]
  return istInstant(day, h, m)
}

const run = (
  periods: ClockPeriod[],
  opts: {
    estimates?: Record<string, number | null>
    workingDays?: string[]
    windows?: Record<string, DayWindow>
    now?: Date
  } = {},
) =>
  computeTaskHours({
    periods,
    estimates: new Map(Object.entries(opts.estimates ?? {})),
    workingDays: new Set(opts.workingDays ?? ["2026-09-15", "2026-09-16", "2026-09-25"]),
    windows: new Map(Object.entries(opts.windows ?? {})),
    now: opts.now ?? ist("2026-10-01", "13:40"),
  })

const hours = (r: ReturnType<typeof run>, day: string, task: string) =>
  Math.round((r.byDay.get(day)?.get(task) ?? 0) * 100) / 100

describe("IST day keys", () => {
  it("puts 00:30 IST on the IST day, not the UTC one", () => {
    expect(istDayKey(new Date("2026-09-14T19:00:00Z"))).toBe("2026-09-15")
  })
  it("builds 09:30 IST as 04:00 UTC", () => {
    expect(istInstant("2026-09-15", 9, 30).toISOString()).toBe("2026-09-15T04:00:00.000Z")
  })
})

describe("attendanceWindow", () => {
  it("uses both punches when they are a real day apart", () => {
    const w = attendanceWindow("2026-09-15", {
      checkIn: ist("2026-09-15", "10:43"),
      checkOut: ist("2026-09-15", "19:25"),
    })
    expect(w.start).toEqual(ist("2026-09-15", "10:43"))
    expect(w.end).toEqual(ist("2026-09-15", "19:25"))
  })
  it("treats a check-out within an hour of check-in as a single punch", () => {
    const w = attendanceWindow("2026-09-02", {
      checkIn: ist("2026-09-02", "10:26"),
      checkOut: ist("2026-09-02", "10:26"),
    })
    expect(w.start).toEqual(ist("2026-09-02", "10:26"))
    expect(w.end).toEqual(ist("2026-09-02", "19:30"))
  })
  it("falls back to 09:30-19:30 with no punch", () => {
    expect(attendanceWindow("2026-09-09", undefined)).toEqual(defaultWindow("2026-09-09"))
  })
})

describe("computeTaskHours", () => {
  it("counts a normal same-day period inside office hours", () => {
    const r = run([
      { taskId: "a", startedAt: ist("2026-09-15", "11:00"), endedAt: ist("2026-09-15", "14:30") },
    ])
    expect(hours(r, "2026-09-15", "a")).toBe(3.5)
    expect(r.capped).toHaveLength(0)
  })

  it("clips a period to the attendance window", () => {
    const r = run(
      [{ taskId: "a", startedAt: ist("2026-09-15", "17:00"), endedAt: ist("2026-09-15", "23:00") }],
      {
        windows: {
          "2026-09-15": { start: ist("2026-09-15", "10:00"), end: ist("2026-09-15", "19:00") },
        },
      },
    )
    expect(hours(r, "2026-09-15", "a")).toBe(2)
  })

  it("caps a clock left running overnight at the task estimate, on its start day only", () => {
    // Mridul, 15 Sep: Navratri template started 12:22, left running to 10:42 next day.
    const r = run(
      [
        {
          taskId: "navratri",
          startedAt: ist("2026-09-15", "12:22"),
          endedAt: ist("2026-09-16", "10:42"),
        },
      ],
      { estimates: { navratri: 5 } },
    )
    expect(hours(r, "2026-09-15", "navratri")).toBe(5)
    expect(r.byDay.get("2026-09-16")).toBeUndefined()
    expect(r.capped).toEqual([
      { taskId: "navratri", day: "2026-09-15", leftRunningHours: 22.3, countedHours: 5 },
    ])
  })

  it("stops a forgotten clock at the end of office hours when the estimate is longer", () => {
    const r = run(
      [{ taskId: "a", startedAt: ist("2026-09-25", "15:14"), endedAt: ist("2026-09-28", "11:15") }],
      { estimates: { a: 5 } },
    )
    expect(hours(r, "2026-09-25", "a")).toBe(4.27)
  })

  it("caps a clock that is still running", () => {
    const r = run([{ taskId: "a", startedAt: ist("2026-09-16", "16:30"), endedAt: null }], {
      estimates: { a: 2 },
    })
    expect(hours(r, "2026-09-16", "a")).toBe(2)
    expect(r.capped[0]?.leftRunningHours).toBeGreaterThan(300)
  })

  it("splits overlapping clocks so the day never exceeds the time present", () => {
    const r = run([
      { taskId: "a", startedAt: ist("2026-09-15", "10:00"), endedAt: ist("2026-09-15", "14:00") },
      { taskId: "b", startedAt: ist("2026-09-15", "12:00"), endedAt: ist("2026-09-15", "16:00") },
    ])
    expect(hours(r, "2026-09-15", "a")).toBe(3)
    expect(hours(r, "2026-09-15", "b")).toBe(3)
  })

  it("ignores periods that start on a non-working day", () => {
    const r = run([
      { taskId: "a", startedAt: ist("2026-09-26", "11:00"), endedAt: ist("2026-09-26", "13:00") },
    ])
    expect(r.byDay.size).toBe(0)
  })
})

describe("splitOverlaps", () => {
  it("gives a lone interval its full length", () => {
    const h = splitOverlaps([{ start: 0, end: 3_600_000, key: "a" }])
    expect(h.get("a")).toBe(1)
  })
})
