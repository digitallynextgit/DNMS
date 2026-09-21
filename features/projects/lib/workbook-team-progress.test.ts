import { describe, expect, it } from "vitest"

import {
  isOutstanding,
  statusProblem,
  teamProgress,
  WORKBOOK_TEAM_STATUSES,
  type WorkbookTeamStatus,
} from "./workbook-team-progress"

/** `teamProgress` only counts lengths, so the contents are irrelevant. */
const n = (count: number) => Array.from({ length: count }, (_, i) => i)

const progress = (quantity: number, links: number, files: number) =>
  teamProgress({ quantity, links: n(links), attachments: n(files) })

describe("teamProgress", () => {
  it("counts links and files together", () => {
    // Some work ships as a URL and some as a file; which it is says nothing
    // about whether the work happened.
    expect(progress(4, 2, 2).handedIn).toBe(4)
    expect(progress(4, 4, 0).handedIn).toBe(4)
    expect(progress(4, 0, 4).handedIn).toBe(4)
  })

  it("reports how much is still short", () => {
    const p = progress(4, 1, 0)
    expect(p.shortBy).toBe(3)
    expect(p.canComplete).toBe(false)
    expect(p.fraction).toBeCloseTo(0.25)
  })

  it("allows completion once the count is met", () => {
    expect(progress(4, 2, 2).canComplete).toBe(true)
    expect(progress(4, 2, 2).shortBy).toBe(0)
  })

  it("does not punish a team for over-delivering", () => {
    const p = progress(2, 5, 0)
    expect(p.canComplete).toBe(true)
    expect(p.shortBy).toBe(0)
    // Capped, so a progress bar cannot overflow its track.
    expect(p.fraction).toBe(1)
  })

  it("exempts a row nobody has quantified", () => {
    // 0 means "on the plan, not yet quantified", not "owes nothing" - so it
    // must not be held to a number nobody set.
    const p = progress(0, 0, 0)
    expect(p.canComplete).toBe(true)
    expect(p.fraction).toBe(1)
    expect(p.shortBy).toBe(0)
  })

  it("treats a negative quantity as unquantified rather than exploding", () => {
    expect(progress(-3, 0, 0).canComplete).toBe(true)
  })
})

describe("statusProblem", () => {
  it("blocks DONE while work is outstanding, and says what is missing", () => {
    const msg = statusProblem("DONE", progress(4, 1, 0))
    expect(msg).toContain("1 of 4")
    expect(msg).toContain("3 more")
  })

  it("gets the singular right when one is missing", () => {
    const msg = statusProblem("DONE", progress(2, 1, 0))!
    expect(msg).toContain("1 more link or file")
    expect(msg).not.toContain("links or files")
  })

  it("allows DONE once everything is in", () => {
    expect(statusProblem("DONE", progress(4, 2, 2))).toBeNull()
  })

  it("never blocks STUCK or DISCARDED", () => {
    // These are how a team says the work is NOT coming. Demanding the work
    // first, in order to admit it is not coming, would be absurd.
    const nothingDone = progress(10, 0, 0)
    expect(statusProblem("STUCK", nothingDone)).toBeNull()
    expect(statusProblem("DISCARDED", nothingDone)).toBeNull()
    expect(statusProblem("TODO", nothingDone)).toBeNull()
    expect(statusProblem("IN_PROGRESS", nothingDone)).toBeNull()
  })

  it("gates exactly one of the five statuses", () => {
    const nothingDone = progress(5, 0, 0)
    const blocked = WORKBOOK_TEAM_STATUSES.filter(
      (s: WorkbookTeamStatus) => statusProblem(s, nothingDone) !== null,
    )
    expect(blocked).toEqual(["DONE"])
  })
})

describe("isOutstanding", () => {
  it("counts work that is still owed", () => {
    expect(isOutstanding("TODO")).toBe(true)
    expect(isOutstanding("IN_PROGRESS")).toBe(true)
    // Blocked is still owed - that is the whole difference from discarded.
    expect(isOutstanding("STUCK")).toBe(true)
  })

  it("does not count work that has arrived or was dropped", () => {
    expect(isOutstanding("DONE")).toBe(false)
    expect(isOutstanding("DISCARDED")).toBe(false)
  })
})
