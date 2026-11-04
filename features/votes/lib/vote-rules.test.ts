import { describe, expect, it } from "vitest"
import {
  canCastVote,
  employeeLabel,
  eventStatus,
  isVoteManagerRoles,
  isVoterRoles,
  rankByVotes,
  tally,
  timeLeft,
} from "./vote-rules"

describe("rankByVotes", () => {
  const opt = (id: string, votes: number | null, position: number) => ({ id, votes, position })
  it("puts the most votes first", () => {
    const r = rankByVotes([opt("a", 1, 0), opt("b", 3, 1), opt("c", 2, 2)])
    expect(r.map((x) => [x.item.id, x.rank])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
    ])
  })
  it("gives ties the same rank and skips the next one", () => {
    const r = rankByVotes([opt("a", 2, 0), opt("b", 2, 1), opt("c", 1, 2)])
    expect(r.map((x) => [x.item.id, x.rank])).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 3],
    ])
  })
  it("keeps ballot order when nobody has votes yet", () => {
    const r = rankByVotes([opt("b", null, 1), opt("a", null, 0)])
    expect(r.map((x) => [x.item.id, x.rank])).toEqual([
      ["a", 1],
      ["b", 1],
    ])
  })
})

describe("timeLeft", () => {
  const min = 60_000
  it("counts minutes under an hour", () => {
    expect(timeLeft(45 * min)).toBe("45m left")
    expect(timeLeft(30_000)).toBe("1m left")
  })
  it("counts hours and minutes under a day", () => {
    expect(timeLeft(192 * min)).toBe("3h 12m left")
    expect(timeLeft(120 * min)).toBe("2h left")
  })
  it("counts days beyond that", () => {
    expect(timeLeft((26 * 60 + 5) * min)).toBe("1d 2h left")
    expect(timeLeft(48 * 60 * min)).toBe("2d left")
  })
  it("says closing now once the time is up", () => {
    expect(timeLeft(0)).toBe("Closing now")
  })
})

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
