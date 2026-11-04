import { describe, expect, it } from "vitest"
import {
  canCastVote,
  employeeLabel,
  eventStatus,
  isVoteManagerRoles,
  isVoterRoles,
  tally,
} from "./vote-rules"

describe("employeeLabel", () => {
  it("joins first and last name", () => {
    expect(employeeLabel("Aman", "Agarwal")).toBe("Aman Agarwal")
  })
  it("collapses stray spaces", () => {
    expect(employeeLabel("Dev ", " Lal")).toBe("Dev Lal")
    expect(employeeLabel("Harsh  ", "Kumar")).toBe("Harsh Kumar")
  })
  it("drops a placeholder dot for a missing last name", () => {
    expect(employeeLabel("Prashant", ".")).toBe("Prashant")
    expect(employeeLabel("Prashant", "")).toBe("Prashant")
  })
})

const now = new Date("2026-11-06T10:00:00.000Z")
const hour = 60 * 60 * 1000
const base = {
  publishedAt: new Date(now.getTime() - hour),
  opensAt: null,
  closesAt: new Date(now.getTime() + hour),
  closedAt: null,
}

describe("eventStatus", () => {
  it("is a draft until published, whatever the dates say", () => {
    expect(eventStatus({ ...base, publishedAt: null }, now)).toBe("DRAFT")
  })
  it("is open between publishing and the closing time when there is no opening time", () => {
    expect(eventStatus(base, now)).toBe("OPEN")
  })
  it("is upcoming before the opening time", () => {
    expect(eventStatus({ ...base, opensAt: new Date(now.getTime() + hour / 2) }, now)).toBe(
      "UPCOMING",
    )
  })
  it("closes on the closing time", () => {
    expect(eventStatus({ ...base, closesAt: now }, now)).toBe("CLOSED")
  })
  it("closes early when an admin closed it", () => {
    expect(eventStatus({ ...base, closedAt: now }, now)).toBe("CLOSED")
  })
  it("accepts ISO strings as well as dates", () => {
    expect(
      eventStatus(
        {
          ...base,
          publishedAt: base.publishedAt.toISOString(),
          closesAt: base.closesAt.toISOString(),
        },
        now,
      ),
    ).toBe("OPEN")
  })
})

describe("who votes and who manages", () => {
  it("gives every non-admin employee a ballot, interns and HR included", () => {
    expect(isVoterRoles(["employee"])).toBe(true)
    expect(isVoterRoles(["hr_manager"])).toBe(true)
    expect(isVoterRoles([])).toBe(true)
  })
  it("gives pure admin accounts no ballot", () => {
    expect(isVoterRoles(["admin"])).toBe(false)
    expect(isVoterRoles(["admin_"])).toBe(false)
  })
  it("treats an admin who also holds the employee role as staff", () => {
    expect(isVoterRoles(["employee", "admin"])).toBe(true)
  })
  it("never gives the hidden owner account a ballot", () => {
    expect(isVoterRoles(["admin_", "employee"])).toBe(false)
  })
  it("lets admins and the HR team run events, nobody else", () => {
    expect(isVoteManagerRoles(["admin_"])).toBe(true)
    expect(isVoteManagerRoles(["admin"])).toBe(true)
    expect(isVoteManagerRoles(["hr_manager"])).toBe(true)
    expect(isVoteManagerRoles(["hr_employee"])).toBe(true)
    expect(isVoteManagerRoles(["employee"])).toBe(false)
  })
  it("only allows a ballot while voting is open", () => {
    expect(canCastVote(["employee"], "OPEN")).toBe(true)
    expect(canCastVote(["employee"], "UPCOMING")).toBe(false)
    expect(canCastVote(["employee"], "CLOSED")).toBe(false)
    expect(canCastVote(["admin"], "OPEN")).toBe(false)
  })
})

describe("tally", () => {
  const options = ["a", "b", "c"]
  it("counts ballots per option and in total", () => {
    const t = tally(options, [{ optionId: "a" }, { optionId: "a" }, { optionId: "b" }])
    expect(t.counts).toEqual({ a: 2, b: 1, c: 0 })
    expect(t.total).toBe(3)
    expect(t.winners).toEqual(["a"])
  })
  it("reports every option on a tie", () => {
    expect(tally(options, [{ optionId: "a" }, { optionId: "c" }]).winners).toEqual(["a", "c"])
  })
  it("has no winner before anyone voted", () => {
    expect(tally(options, []).winners).toEqual([])
  })
  it("ignores ballots for options that were removed", () => {
    const t = tally(options, [{ optionId: "gone" }, { optionId: "b" }])
    expect(t.total).toBe(1)
    expect(t.counts.b).toBe(1)
  })
})
