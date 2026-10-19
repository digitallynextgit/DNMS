import { describe, expect, it } from "vitest"
import {
  applyCriteriaEdit,
  dayAverages,
  dayStatus,
  formatScore,
  isScore,
  parseCardCriteria,
  ratingFor,
  scorecardDates,
  scorecardSummary,
  type CriterionEntry,
  type DayScores,
} from "./scorecard"

const empty: DayScores = {
  mgrJobRole: null,
  mgrCommunication: null,
  mgrLearning: null,
  hrDiscipline: null,
  hrCulture: null,
  hrLearning: null,
}

describe("dayAverages", () => {
  it("averages each side and weighs the two sides equally overall", () => {
    const d = dayAverages({
      mgrJobRole: 4,
      mgrCommunication: 5,
      mgrLearning: 3,
      hrDiscipline: 5,
      hrCulture: 5,
      hrLearning: 5,
    })
    expect(d.manager).toBe(4)
    expect(d.hr).toBe(5)
    expect(d.overall).toBe(4.5)
  })

  it("uses only the scores given, and is null with none", () => {
    expect(dayAverages({ ...empty, mgrJobRole: 2, mgrLearning: 4 })).toEqual({
      manager: 3,
      hr: null,
      overall: 3,
    })
    expect(dayAverages(empty)).toEqual({ manager: null, hr: null, overall: null })
  })
})

describe("scorecardSummary", () => {
  it("averages each side over the days it scored, then rates the overall", () => {
    const s = scorecardSummary([
      { ...empty, mgrJobRole: 4, hrDiscipline: 5 },
      { ...empty, mgrJobRole: 2, hrDiscipline: 3 },
      empty,
    ])
    expect(s.manager).toBe(3)
    expect(s.hr).toBe(4)
    expect(s.overall).toBe(3.5)
    expect(s.rating?.label).toBe("Good") // 3.5 rounds to 4
    expect(s.scoredDays).toBe(2)
  })

  it("is all null for a scorecard nobody has filled in", () => {
    const s = scorecardSummary([empty, empty])
    expect(s).toEqual({ manager: null, hr: null, overall: null, rating: null, scoredDays: 0 })
  })
})

describe("helpers", () => {
  it("rates to the nearest guide entry", () => {
    expect(ratingFor(4.6)?.label).toBe("Excellent")
    expect(ratingFor(2.4)?.label).toBe("Needs Improvement")
    expect(ratingFor(1)?.label).toBe("Unsatisfactory")
    expect(ratingFor(null)).toBeNull()
  })

  it("accepts only whole scores 1-5", () => {
    expect([1, 3, 5].every(isScore)).toBe(true)
    expect([0, 6, 2.5, "3", null].some(isScore)).toBe(false)
  })

  it("formats to one decimal", () => {
    expect(formatScore(4.333)).toBe("4.3")
    expect(formatScore(5)).toBe("5.0")
    expect(formatScore(null)).toBe("-")
  })
})

describe("custom criteria", () => {
  it("averages whatever criteria the company has, by key", () => {
    const criteria = [
      { key: "mgrJobRole", side: "MANAGER" as const, label: "Role" },
      { key: "custom.client-handling", side: "MANAGER" as const, label: "Client handling" },
      { key: "hrDiscipline", side: "HR" as const, label: "Discipline" },
    ]
    const d = dayAverages(
      { mgrJobRole: 4, "custom.client-handling": 2, hrDiscipline: 5, hrCulture: 1 },
      criteria,
    )
    // hrCulture is not a criterion any more, so it is ignored.
    expect(d).toEqual({ manager: 3, hr: 5, overall: 4 })
    expect(
      scorecardSummary([{ mgrJobRole: 4 }, { "custom.client-handling": 2 }], criteria),
    ).toMatchObject({
      manager: 3,
      hr: null,
      overall: 3,
      scoredDays: 2,
    })
  })
})

describe("scorecardDates", () => {
  it("covers 15 calendar days from joining, weekends included", () => {
    const days = scorecardDates("2027-01-01")
    expect(days).toHaveLength(15)
    expect(days[0]!.toISOString().slice(0, 10)).toBe("2027-01-01")
    expect(days[14]!.toISOString().slice(0, 10)).toBe("2027-01-15")
  })
})

describe("dayStatus", () => {
  const holidays = new Map([["2026-10-20", "Dussehra"]])
  const leaves = [
    { start: "2026-10-22", end: "2026-10-23", totalDays: 2, type: "Casual Leave" },
    { start: "2026-10-26", end: "2026-10-26", totalDays: 0.5, type: "Sick Leave" },
    { start: "2026-10-27", end: "2026-10-27", totalDays: 0.25, type: "Casual Leave" },
  ]
  const at = (d: string) => dayStatus(d, holidays, leaves)

  it("marks weekends, holidays and full-day leave as not scored", () => {
    expect(at("2026-10-17").off).toEqual({ kind: "weekend", label: "Weekend" })
    expect(at("2026-10-20").off).toEqual({ kind: "holiday", label: "Holiday · Dussehra" })
    expect(at("2026-10-23").off).toEqual({ kind: "leave", label: "On leave · Casual Leave" })
  })

  it("keeps a part-day leave scored, with a note", () => {
    expect(at("2026-10-26")).toEqual({ off: null, note: "Half-day leave · Sick Leave" })
    expect(at("2026-10-27")).toEqual({ off: null, note: "Short leave · Casual Leave" })
  })

  it("leaves an ordinary working day alone", () => {
    expect(at("2026-10-21")).toEqual({ off: null, note: null })
  })
})

describe("card criteria", () => {
  const current: CriterionEntry[] = [
    { key: "mgrJobRole", side: "MANAGER", label: "Job role", isActive: true },
    { key: "hrCulture", side: "HR", label: "Culture", isActive: true },
    { key: "custom.client-handling", side: "MANAGER", label: "Client handling", isActive: true },
  ]

  it("reads a stored list and refuses anything malformed", () => {
    expect(parseCardCriteria(current)).toEqual(current)
    expect(parseCardCriteria(null)).toBeNull()
    expect(parseCardCriteria([{ key: "x", side: "BOSS", label: "X" }])).toBeNull()
  })

  it("renames and reorders, keys new rows apart, and hides rows left out", () => {
    const next = applyCriteriaEdit(current, [
      { key: "hrCulture", side: "HR", label: "Culture fit", isActive: true },
      { key: "mgrJobRole", side: "MANAGER", label: "Job role", isActive: true },
      { key: null, side: "MANAGER", label: "Client handling", isActive: true },
    ])
    expect(next.map((c) => [c.key, c.label, c.isActive])).toEqual([
      ["hrCulture", "Culture fit", true],
      ["mgrJobRole", "Job role", true],
      // The old "Client handling" keeps its key (and scores); the new one gets its own.
      ["custom.client-handling-2", "Client handling", true],
      ["custom.client-handling", "Client handling", false],
    ])
  })
})
