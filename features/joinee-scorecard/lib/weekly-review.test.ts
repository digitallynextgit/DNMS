import { describe, expect, it } from "vitest"
import {
  applyParamEdit,
  parseReviewScores,
  reviewSummary,
  weekAverage,
  weekIsOpen,
  weekState,
  weeklyReviewFridays,
  type ReviewParam,
} from "./weekly-review"

const iso = (d: Date) => d.toISOString().slice(0, 10)

describe("weeklyReviewFridays", () => {
  it("starts the Friday of the week the 15th day falls in, and runs 90 days", () => {
    // Joined Mon 12 Oct 2026: day 15 is Mon 26 Oct.
    const fridays = weeklyReviewFridays("2026-10-12")
    expect(iso(fridays[0]!)).toBe("2026-10-30")
    expect(iso(fridays.at(-1)!)).toBe("2027-01-22")
    expect(fridays).toHaveLength(13)
    expect(fridays.every((d) => d.getUTCDay() === 5)).toBe(true)
  })

  it("uses the 15th day itself when it is a Friday, and the next one after a weekend", () => {
    // Day 15 = Fri 16 Oct 2026 (joined Fri 2 Oct).
    expect(iso(weeklyReviewFridays("2026-10-02")[0]!)).toBe("2026-10-16")
    // Day 15 = Sat 17 Oct 2026 (joined Sat 3 Oct): that week's Friday has passed.
    expect(iso(weeklyReviewFridays("2026-10-03")[0]!)).toBe("2026-10-23")
  })
})

describe("weekState and weekIsOpen", () => {
  it("is due from the Friday, overdue after the Monday reminder, done once filled", () => {
    expect(weekState("2026-10-30", false, "2026-10-29")).toBe("upcoming")
    expect(weekState("2026-10-30", false, "2026-10-30")).toBe("due")
    expect(weekState("2026-10-30", false, "2026-11-02")).toBe("due")
    expect(weekState("2026-10-30", false, "2026-11-03")).toBe("overdue")
    expect(weekState("2026-10-30", true, "2026-11-10")).toBe("done")
  })

  it("opens a Friday from the Monday of its week", () => {
    expect(weekIsOpen("2026-10-30", "2026-10-25")).toBe(false)
    expect(weekIsOpen("2026-10-30", "2026-10-26")).toBe(true)
  })
})

describe("scores and averages", () => {
  const params: ReviewParam[] = [
    { key: "quality", label: "Quality", isActive: true },
    { key: "ownership", label: "Ownership", isActive: true },
    { key: "old", label: "Old", isActive: false },
  ]

  it("keeps only 1-5 scores and averages the visible parameters", () => {
    const scores = parseReviewScores({ quality: 4, ownership: 3, old: 1, junk: 9, bad: "5" })
    expect(scores).toEqual({ quality: 4, ownership: 3, old: 1 })
    expect(weekAverage(scores, params)).toBe(3.5)
    expect(weekAverage({}, params)).toBeNull()
  })

  it("averages the weeks that have a score", () => {
    expect(reviewSummary([4, null, 3])).toEqual({ overall: 3.5, scoredWeeks: 2 })
  })
})

describe("applyParamEdit", () => {
  it("renames, keys new rows apart, and hides rows left out", () => {
    const current: ReviewParam[] = [
      { key: "quality", label: "Quality of work", isActive: true },
      { key: "p.client-handling", label: "Client handling", isActive: true },
    ]
    const next = applyParamEdit(current, [
      { key: "quality", label: "Work quality", isActive: true },
      { key: null, label: "Client handling", isActive: true },
    ])
    expect(next).toEqual([
      { key: "quality", label: "Work quality", isActive: true },
      { key: "p.client-handling-2", label: "Client handling", isActive: true },
      { key: "p.client-handling", label: "Client handling", isActive: false },
    ])
  })
})
