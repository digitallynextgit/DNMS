import { describe, expect, it } from "vitest"
import { getProbationEndDate, getProbationStatus, isOnProbation } from "./probation"

const now = new Date("2026-10-15T00:00:00Z")

describe("getProbationEndDate", () => {
  it("adds probationMonths to the joining date", () => {
    const end = getProbationEndDate({ dateOfJoining: "2026-03-06", probationMonths: 6 })
    expect(end?.toISOString().slice(0, 10)).toBe("2026-09-06")
  })

  it("prefers an explicit probationEndDate (HR extension)", () => {
    const end = getProbationEndDate({
      dateOfJoining: "2026-03-06",
      probationMonths: 6,
      probationEndDate: "2027-04-15",
    })
    expect(end?.toISOString().slice(0, 10)).toBe("2027-04-15")
  })

  it("is null without a joining date or an explicit end", () => {
    expect(getProbationEndDate({ probationMonths: 6 })).toBeNull()
  })
})

describe("isOnProbation", () => {
  it("ends once joining + probationMonths has passed", () => {
    expect(
      isOnProbation({ onProbation: true, dateOfJoining: "2026-03-06", probationMonths: 6 }, now),
    ).toBe(false)
  })

  it("stays on when HR extended it with probationEndDate", () => {
    expect(
      isOnProbation(
        {
          onProbation: true,
          dateOfJoining: "2026-03-06",
          probationMonths: 6,
          probationEndDate: "2027-04-15",
        },
        now,
      ),
    ).toBe(true)
  })

  it("is off when the admin toggled it off, whatever the dates say", () => {
    expect(
      isOnProbation(
        { onProbation: false, dateOfJoining: "2026-10-01", probationEndDate: "2027-04-15" },
        now,
      ),
    ).toBe(false)
  })
})

describe("getProbationStatus", () => {
  it("counts the days left to the explicit end", () => {
    const status = getProbationStatus(
      { onProbation: true, dateOfJoining: "2026-03-06", probationEndDate: "2026-10-20" },
      now,
    )
    expect(status.onProbation).toBe(true)
    expect(status.daysRemaining).toBe(5)
  })
})
