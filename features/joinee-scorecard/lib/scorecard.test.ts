import { describe, expect, it } from "vitest"
import {
  dayAverages,
  formatScore,
  isScore,
  ratingFor,
  scorecardSummary,
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
