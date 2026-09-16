import { describe, expect, it } from "vitest"

import { addDays, latestCalendarDay } from "@/lib/dates"
import {
  DELIVERABLE_STATUS_LABELS,
  LOCK_DAYS,
  MADE_STATUSES,
  MAX_REPEAT,
  OPEN_STATUSES,
  OUTCOME_STATUSES,
  STATUS_ORDER,
  allowedTransition,
  isMadeStatus,
  isOutcomeStatus,
  nextActions,
  periodClosesOn,
  periodOpen,
  repeatDueDates,
  splitTaskHours,
  type DeliverableActor,
  type DeliverableStatus,
  hasProof,
} from "./deliverable-lifecycle"

const ACTORS: DeliverableActor[] = ["none", "maker", "team_manager", "project_manager"]

// The whole table, written out rather than derived: a test that computes the
// answer the same way the code does proves nothing.
const ALLOWED: { from: DeliverableStatus; to: DeliverableStatus; min: DeliverableActor }[] = [
  { from: "PLANNED", to: "IN_PROGRESS", min: "maker" },
  // Staff may not jump straight to made - that hides the state a manager reads.
  // The account manager can, because a client recording "this exists" arrives
  // through them and never passed through IN_PROGRESS.
  { from: "PLANNED", to: "DELIVERED", min: "project_manager" },
  { from: "PLANNED", to: "STUCK", min: "maker" },
  { from: "PLANNED", to: "DISCARDED", min: "maker" },
  { from: "IN_PROGRESS", to: "PLANNED", min: "maker" },
  { from: "IN_PROGRESS", to: "DELIVERED", min: "maker" },
  { from: "IN_PROGRESS", to: "STUCK", min: "maker" },
  { from: "IN_PROGRESS", to: "DISCARDED", min: "maker" },
  // Blocked, not finished: everything an unstarted row can do.
  { from: "STUCK", to: "PLANNED", min: "maker" },
  { from: "STUCK", to: "IN_PROGRESS", min: "maker" },
  { from: "STUCK", to: "DELIVERED", min: "maker" },
  { from: "STUCK", to: "DISCARDED", min: "maker" },
  { from: "DELIVERED", to: "ACCEPTED", min: "project_manager" },
  // The team manager bounces work at their stage; only the account manager accepts.
  { from: "DELIVERED", to: "REJECTED", min: "team_manager" },
  { from: "DELIVERED", to: "IN_PROGRESS", min: "maker" },
  { from: "DELIVERED", to: "STUCK", min: "maker" },
  { from: "DELIVERED", to: "DISCARDED", min: "maker" },
  { from: "REJECTED", to: "DELIVERED", min: "maker" },
  { from: "ACCEPTED", to: "DELIVERED", min: "project_manager" },
  // Revived only back to the start: straight to "made" would skip the question
  // of whether it was ever actually done.
  { from: "DISCARDED", to: "PLANNED", min: "maker" },
]

const NEEDS: Record<string, string[]> = {
  "PLANNED>IN_PROGRESS": [],
  "PLANNED>DELIVERED": ["completedOn"],
  "PLANNED>STUCK": ["reason"],
  "PLANNED>DISCARDED": ["reason"],
  "IN_PROGRESS>PLANNED": [],
  "IN_PROGRESS>DELIVERED": ["completedOn"],
  "IN_PROGRESS>STUCK": ["reason"],
  "IN_PROGRESS>DISCARDED": ["reason"],
  "STUCK>PLANNED": [],
  "STUCK>IN_PROGRESS": [],
  "STUCK>DELIVERED": ["completedOn"],
  "STUCK>DISCARDED": ["reason"],
  "DELIVERED>ACCEPTED": [],
  "DELIVERED>REJECTED": ["reason"],
  "DELIVERED>IN_PROGRESS": [],
  "DELIVERED>STUCK": ["reason"],
  "DELIVERED>DISCARDED": ["reason"],
  "REJECTED>DELIVERED": ["completedOn"],
  "ACCEPTED>DELIVERED": ["reason"],
  "DISCARDED>PLANNED": [],
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
    // Built from DELIVERABLE_STATUS_LABELS, so it followed the rename to "Made".
    if (!res.ok) expect(res.why).toBe("It is already made.")
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
  it("gives a maker start-or-stop on a to-do row, but never a jump to made", () => {
    // Finishing still comes after starting for staff; stopping does not, because
    // work can be blocked or called off before anyone touches it.
    expect(nextActions("PLANNED", "maker")).toEqual(["IN_PROGRESS", "STUCK", "DISCARDED"])
  })

  it("gives a maker no VERDICT on a delivered row - that part is not theirs", () => {
    // They may reopen, block or drop it; they may not accept or reject it. That
    // distinction is the original intent of this test, and it still holds.
    const moves = nextActions("DELIVERED", "maker")
    expect(moves).not.toContain("ACCEPTED")
    expect(moves).not.toContain("REJECTED")
    expect(moves).toEqual(["IN_PROGRESS", "STUCK", "DISCARDED"])
  })

  it("gives a project manager accept and reject on a delivered row", () => {
    expect(nextActions("DELIVERED", "project_manager")).toEqual([
      "IN_PROGRESS",
      "STUCK",
      "ACCEPTED",
      "REJECTED",
      "DISCARDED",
    ])
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

  it("puts every status in made or open, bar the one deliberate exception", () => {
    // THE invariant that stops a status silently falling out of every report:
    // a value in neither set is counted nowhere, and nothing else complains.
    //
    // DISCARDED is the single intended exception - dropped work was never made
    // and is no longer owed. Any OTHER status landing in neither set is a bug,
    // so this asserts both directions rather than just the exclusivity.
    const NEITHER: DeliverableStatus[] = ["DISCARDED"]
    for (const s of STATUS_ORDER) {
      const made = (MADE_STATUSES as readonly string[]).includes(s)
      const open = (OPEN_STATUSES as readonly string[]).includes(s)
      expect(made && open, `${s} cannot be both made and open`).toBe(false)
      expect(made || open, `${s} must be made or open`).toBe(!NEITHER.includes(s))
    }
  })

  it("counts stuck work as still owed, and discarded work as neither", () => {
    // Why it matters: STUCK in OPEN is what keeps blocked work on the "what do
    // we owe" lists instead of vanishing; DISCARDED in neither is what stops
    // called-off work being chased or credited.
    expect((OPEN_STATUSES as readonly string[]).includes("STUCK")).toBe(true)
    expect(isMadeStatus("STUCK")).toBe(false)
    expect(isMadeStatus("DISCARDED")).toBe(false)
    expect((OPEN_STATUSES as readonly string[]).includes("DISCARDED")).toBe(false)
    expect(isOutcomeStatus("STUCK")).toBe(false)
    expect(isOutcomeStatus("DISCARDED")).toBe(false)
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

// ─── Repeating commitments ────────────────────────────────────────────────────

describe("repeatDueDates", () => {
  const day = (s: string) => new Date(`${s}T00:00:00.000Z`)
  const ymd = (d: Date) => d.toISOString().slice(0, 10)
  const run = (start: string, every: "WEEK" | "MONTH", n: number) =>
    repeatDueDates(day(start), every, n).map(ymd)

  it("includes the first date and steps a week at a time", () => {
    expect(run("2026-09-14", "WEEK", 4)).toEqual([
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
    ])
  })

  it("crosses a year boundary without drifting", () => {
    expect(run("2026-12-28", "WEEK", 3)).toEqual(["2026-12-28", "2027-01-04", "2027-01-11"])
  })

  it("steps months, keeping the day of the month", () => {
    expect(run("2026-09-15", "MONTH", 4)).toEqual([
      "2026-09-15",
      "2026-10-15",
      "2026-11-15",
      "2026-12-15",
    ])
  })

  it("clamps a month-end start to the last day of each month", () => {
    // Not 2 March: a commitment made on the 31st is due at each month's end.
    expect(run("2027-01-31", "MONTH", 4)).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
      "2027-04-30",
    ])
  })

  it("measures every step from the FIRST date, so a clamp cannot cascade", () => {
    // If March were computed from 28 Feb it would land on the 28th, and every
    // month after it would be wrong too.
    const out = run("2028-01-31", "MONTH", 3)
    expect(out[1]).toBe("2028-02-29") // leap year
    expect(out[2]).toBe("2028-03-31")
  })

  it("always produces at least one date, whatever nonsense the count is", () => {
    expect(run("2026-09-14", "WEEK", 0)).toEqual(["2026-09-14"])
    expect(run("2026-09-14", "WEEK", -5)).toEqual(["2026-09-14"])
    expect(run("2026-09-14", "WEEK", 1.7)).toEqual(["2026-09-14"])
  })

  it("caps at a year of weeks", () => {
    expect(repeatDueDates(day("2026-09-14"), "WEEK", 500)).toHaveLength(MAX_REPEAT)
  })

  it("does not mutate the date it was given", () => {
    const start = day("2026-09-14")
    repeatDueDates(start, "MONTH", 6)
    expect(ymd(start)).toBe("2026-09-14")
  })
})

describe("hasProof", () => {
  const bare = { links: [] as string[], files: [] as unknown[], notes: null }

  it("is false when the item shows nothing at all", () => {
    expect(hasProof(bare)).toBe(false)
  })

  it("counts a link", () => {
    expect(hasProof({ ...bare, links: ["https://example.com/post"] })).toBe(true)
  })

  it("counts a file", () => {
    expect(hasProof({ ...bare, files: [{ id: "f1" }] })).toBe(true)
  })

  it("counts a note, because real work does not always leave a URL", () => {
    // A call made, a page checked, an account reconciled.
    expect(hasProof({ ...bare, notes: "Rang the vendor, pricing confirmed." })).toBe(true)
  })

  it("does not count whitespace as a note", () => {
    expect(hasProof({ ...bare, notes: "   \n  " })).toBe(false)
  })
})

// ─── The client actor ────────────────────────────────────────────────────────
// Written out separately from ACTORS on purpose. The client is not a rung on
// the staff ladder - they may accept, which outranks a team manager, and may
// not start work, which a maker can - so folding them into the ranked loop
// would test a relationship that does not exist.

describe("the client actor", () => {
  // Every move the portal may make, named one at a time. The portal is a
  // tracker now, not an approval queue: the client sets the state of the work
  // and does NOT give a verdict on it.
  const CLIENT_ALLOWED: Record<string, string[]> = {
    "PLANNED>IN_PROGRESS": [],
    // No completedOn from the portal - they are recording that it happened,
    // not filing it against a date. The server dates it today.
    "PLANNED>DELIVERED": [],
    "PLANNED>STUCK": ["reason"],
    "PLANNED>DISCARDED": ["reason"],
    "IN_PROGRESS>PLANNED": [],
    "IN_PROGRESS>DELIVERED": [],
    "IN_PROGRESS>STUCK": ["reason"],
    "IN_PROGRESS>DISCARDED": ["reason"],
    "STUCK>PLANNED": [],
    "STUCK>IN_PROGRESS": [],
    "STUCK>DELIVERED": [],
    "STUCK>DISCARDED": ["reason"],
    "DELIVERED>IN_PROGRESS": [],
    "DELIVERED>STUCK": ["reason"],
    "DELIVERED>DISCARDED": ["reason"],
    "DISCARDED>PLANNED": [],
  }

  for (const from of STATUS_ORDER) {
    for (const to of STATUS_ORDER) {
      const needs = CLIENT_ALLOWED[`${from}>${to}`]
      const expected = needs !== undefined
      it(`${from} -> ${to} as a client is ${expected ? "allowed" : "refused"}`, () => {
        const res = allowedTransition(from, to, "client")
        expect(res.ok).toBe(expected)
        if (res.ok) expect(res.needs).toEqual(needs)
      })
    }
  }

  // ── The approval loop is closed to the portal ──────────────────────────────
  // These two used to be the ONLY client moves. They are now staff-only, which
  // is the whole "drop the approval flow" change - asserted here because the
  // portal draws its buttons from this table and nothing else guards it.

  it("no longer finalises work - that is the account manager's again", () => {
    const res = allowedTransition("DELIVERED", "ACCEPTED", "client")
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe("actor")
  })

  it("no longer sends work back", () => {
    const res = allowedTransition("DELIVERED", "REJECTED", "client")
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe("actor")
  })

  it("leaves both verdicts working for staff", () => {
    expect(allowedTransition("DELIVERED", "ACCEPTED", "project_manager").ok).toBe(true)
    expect(allowedTransition("DELIVERED", "REJECTED", "team_manager").ok).toBe(true)
  })

  it("cannot re-open an accepted row - the verdict stays the staff side's", () => {
    const res = allowedTransition("ACCEPTED", "DELIVERED", "client")
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe("actor")
  })

  it("cannot redeliver a rejected row", () => {
    expect(allowedTransition("REJECTED", "DELIVERED", "client").ok).toBe(false)
  })

  it("must say why before flagging stuck or discarding", () => {
    // "Blocked" with nothing named is a row nobody can act on - the same thing
    // REJECTED's reason has always existed to prevent.
    for (const to of ["STUCK", "DISCARDED"] as DeliverableStatus[]) {
      const res = allowedTransition("IN_PROGRESS", to, "client")
      expect(res.ok, to).toBe(true)
      if (res.ok) expect(res.needs, to).toEqual(["reason"])
    }
  })

  it("is never asked for a completion date - the server dates it", () => {
    for (const from of ["PLANNED", "IN_PROGRESS", "STUCK"] as DeliverableStatus[]) {
      const res = allowedTransition(from, "DELIVERED", "client")
      expect(res.ok, from).toBe(true)
      if (res.ok) expect(res.needs, from).toEqual([])
    }
  })

  it("offers the tracker moves the portal draws", () => {
    // Order follows STATUS_ORDER, which is the reading order the dropdown uses.
    expect(nextActions("PLANNED", "client")).toEqual([
      "IN_PROGRESS",
      "STUCK",
      "DELIVERED",
      "DISCARDED",
    ])
    expect(nextActions("STUCK", "client")).toEqual([
      "PLANNED",
      "IN_PROGRESS",
      "DELIVERED",
      "DISCARDED",
    ])
    expect(nextActions("DISCARDED", "client")).toEqual(["PLANNED"])
  })

  it("offers nothing on a row the staff side has ruled on", () => {
    for (const s of ["ACCEPTED", "REJECTED"] as DeliverableStatus[]) {
      expect(nextActions(s, "client"), s).toEqual([])
    }
  })

  it("leaves the account manager's reopen intact", () => {
    // The escape hatch that makes giving the client the last word safe.
    const res = allowedTransition("ACCEPTED", "DELIVERED", "project_manager")
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.needs).toEqual(["reason"])
  })
})
