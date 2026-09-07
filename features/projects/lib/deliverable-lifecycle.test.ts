import { describe, expect, it } from "vitest"

import { addDays, latestCalendarDay } from "@/lib/dates"
import {
  DELIVERABLE_STATUS_LABELS,
  LOCK_DAYS,
  MADE_STATUSES,
  OPEN_STATUSES,
  OUTCOME_STATUSES,
  STATUS_ORDER,
  allowedTransition,
  isMadeStatus,
  isOutcomeStatus,
  nextActions,
  periodClosesOn,
  periodOpen,
  splitTaskHours,
  type DeliverableActor,
  type DeliverableStatus,
} from "./deliverable-lifecycle"

const ACTORS: DeliverableActor[] = ["none", "maker", "team_manager", "project_manager"]

// The whole table, written out rather than derived: a test that computes the
// answer the same way the code does proves nothing.
const ALLOWED: { from: DeliverableStatus; to: DeliverableStatus; min: DeliverableActor }[] = [
  { from: "PLANNED", to: "IN_PROGRESS", min: "maker" },
  { from: "PLANNED", to: "DELIVERED", min: "maker" },
  { from: "IN_PROGRESS", to: "DELIVERED", min: "maker" },
  { from: "DELIVERED", to: "ACCEPTED", min: "project_manager" },
  { from: "DELIVERED", to: "REJECTED", min: "project_manager" },
  { from: "REJECTED", to: "DELIVERED", min: "maker" },
  { from: "ACCEPTED", to: "DELIVERED", min: "project_manager" },
]

const NEEDS: Record<string, string[]> = {
  "PLANNED>IN_PROGRESS": [],
  "PLANNED>DELIVERED": ["completedOn"],
  "IN_PROGRESS>DELIVERED": ["completedOn"],
  "DELIVERED>ACCEPTED": [],
  "DELIVERED>REJECTED": ["reason"],
  "REJECTED>DELIVERED": ["completedOn"],
  "ACCEPTED>DELIVERED": ["reason"],
}

const rank = (a: DeliverableActor) => ACTORS.indexOf(a)
const key = (from: DeliverableStatus, to: DeliverableStatus) => `${from}>${to}`
const isAllowedPair = (from: DeliverableStatus, to: DeliverableStatus) =>
  ALLOWED.find((r) => r.from === from && r.to === to)

describe("allowedTransition", () => {
  // 5 × 5 × 4 = 100 cases.
  for (const from of STATUS_ORDER) {
    for (const to of STATUS_ORDER) {
      for (const actor of ACTORS) {
        const rule = isAllowedPair(from, to)
        const expected = !!rule && rank(actor) >= rank(rule.min)
        it(`${from} -> ${to} as ${actor} is ${expected ? "allowed" : "refused"}`, () => {
          const res = allowedTransition(from, to, actor)
          expect(res.ok).toBe(expected)
          if (res.ok) {
            expect(res.needs).toEqual(NEEDS[key(from, to)])
          } else {
            expect(res.why.length).toBeGreaterThan(3)
            // Wrong PERSON for a real move vs a move that does not exist.
            expect(res.reason).toBe(rule ? "actor" : "path")
          }
        })
      }
    }
  }

  it("names the same-status case instead of falling through to 'not a step'", () => {
    const res = allowedTransition("DELIVERED", "DELIVERED", "project_manager")
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.why).toBe("It is already delivered.")
  })

  it("tells a manager to un-accept before rejecting", () => {
    const res = allowedTransition("ACCEPTED", "REJECTED", "project_manager")
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.why).toBe("Un-accept it first.")
  })

  it("sends a rejected row back through a redelivery, not straight to accepted", () => {
    const res = allowedTransition("REJECTED", "ACCEPTED", "project_manager")
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.why).toBe("Must go through a redelivery.")
  })

  it("refuses to re-open a delivered row", () => {
    const res = allowedTransition("DELIVERED", "PLANNED", "project_manager")
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.why).toBe("Delete and re-plan instead.")
  })
})

describe("nextActions", () => {
  it("gives a maker start and deliver on an owed row", () => {
    expect(nextActions("PLANNED", "maker")).toEqual(["IN_PROGRESS", "DELIVERED"])
  })

  it("gives a maker nothing on a delivered row - the verdict is not theirs", () => {
    expect(nextActions("DELIVERED", "maker")).toEqual([])
  })

  it("gives a project manager accept and reject on a delivered row", () => {
    expect(nextActions("DELIVERED", "project_manager")).toEqual(["ACCEPTED", "REJECTED"])
  })

  it("gives an outsider nothing anywhere", () => {
    for (const s of STATUS_ORDER) expect(nextActions(s, "none")).toEqual([])
  })

  it("offers only redelivery on a rejected row", () => {
    expect(nextActions("REJECTED", "team_manager")).toEqual(["DELIVERED"])
  })

  it("offers only un-accept on an accepted row", () => {
    expect(nextActions("ACCEPTED", "project_manager")).toEqual(["DELIVERED"])
  })
})

describe("status sets", () => {
  it("counts a rejected thing as made but not as an outcome", () => {
    expect(isMadeStatus("REJECTED")).toBe(true)
    expect(isOutcomeStatus("REJECTED")).toBe(false)
  })

  it("splits every status into exactly one of made / open", () => {
    for (const s of STATUS_ORDER) {
      const made = (MADE_STATUSES as readonly string[]).includes(s)
      const open = (OPEN_STATUSES as readonly string[]).includes(s)
      expect(made).toBe(!open)
    }
  })

  it("keeps outcomes a subset of made", () => {
    for (const s of OUTCOME_STATUSES) expect(isMadeStatus(s)).toBe(true)
  })

  it("labels every status", () => {
    for (const s of STATUS_ORDER) expect(DELIVERABLE_STATUS_LABELS[s]).toBeTruthy()
  })
})

describe("periodOpen", () => {
  const today = new Date(Date.UTC(2026, 8, 7))

  it("is open on the boundary day itself", () => {
    expect(periodOpen(addDays(today, -LOCK_DAYS), today)).toBe(true)
  })

  it("is closed the day after the boundary", () => {
    expect(periodOpen(addDays(today, -LOCK_DAYS - 1), today)).toBe(false)
  })

  it("treats owed work (no completed date) as always open", () => {
    expect(periodOpen(null, today)).toBe(true)
    expect(periodOpen(undefined, today)).toBe(true)
  })

  it("is open for today and for a same-day entry", () => {
    expect(periodOpen(today, today)).toBe(true)
    expect(periodOpen(addDays(today, -1), today)).toBe(true)
  })

  it("names the closing day as completed + LOCK_DAYS", () => {
    expect(
      periodClosesOn(new Date(Date.UTC(2026, 8, 1)))
        .toISOString()
        .slice(0, 10),
    ).toBe("2026-09-08")
  })
})

describe("latestCalendarDay", () => {
  const today = new Date(Date.UTC(2026, 8, 7))

  it("allows tomorrow - a picker in UTC+14 is already there", () => {
    expect(addDays(today, 1) > latestCalendarDay(today)).toBe(false)
  })

  it("rejects the day after tomorrow", () => {
    expect(addDays(today, 2) > latestCalendarDay(today)).toBe(true)
  })

  it("still allows today", () => {
    expect(today > latestCalendarDay(today)).toBe(false)
  })
})

describe("splitTaskHours", () => {
  it("splits an 8h task with four units 3 / 1", () => {
    expect(splitTaskHours(8, 3, 4)).toBe(6)
    expect(splitTaskHours(8, 1, 4)).toBe(2)
  })

  it("gives the whole task to its only deliverable", () => {
    expect(splitTaskHours(8, 1, 1)).toBe(8)
  })

  it("never exceeds the task when the tally lags behind the row", () => {
    expect(splitTaskHours(8, 3, 1)).toBe(8)
    expect(splitTaskHours(8, 3, 0)).toBe(8)
  })

  it("is zero when nothing was logged", () => {
    expect(splitTaskHours(0, 3, 4)).toBe(0)
  })

  it("is zero rather than NaN when there is nothing to divide by", () => {
    expect(splitTaskHours(8, 0, 0)).toBe(0)
  })
})
