import { describe, expect, it } from "vitest"

import { assignRefusal, assignableIds, mayAssignTo, type AssignContext } from "./task-assign"

const ctx = (p: Partial<AssignContext> = {}): AssignContext => ({
  actorId: "riya",
  canAssignAnyone: false,
  teamMemberIds: ["riya", "aman", "neha", "ravi"],
  reportIds: ["aman", "karan"],
  ...p,
})

describe("mayAssignTo", () => {
  it("lets a member take a task themselves", () => {
    expect(mayAssignTo(ctx(), "riya")).toBe(true)
  })
  it("lets a member hand it to a report on the same team", () => {
    expect(mayAssignTo(ctx(), "aman")).toBe(true)
  })
  it("refuses a teammate who doesn't report to them", () => {
    expect(mayAssignTo(ctx(), "neha")).toBe(false)
  })
  it("refuses a report who is not on the team", () => {
    expect(mayAssignTo(ctx(), "karan")).toBe(false)
  })
  it("lets the team or project manager pick anyone on the team, and only on it", () => {
    const boss = ctx({ actorId: "meera", canAssignAnyone: true, reportIds: [] })
    expect(mayAssignTo(boss, "neha")).toBe(true)
    expect(mayAssignTo(boss, "karan")).toBe(false)
  })
})

describe("assignableIds / assignRefusal", () => {
  it("lists the allowed members in team order", () => {
    expect(assignableIds(ctx())).toEqual(["riya", "aman"])
    expect(assignableIds(ctx({ canAssignAnyone: true }))).toEqual(["riya", "aman", "neha", "ravi"])
  })
  it("explains a refusal", () => {
    expect(assignRefusal(ctx(), "aman")).toBeNull()
    expect(assignRefusal(ctx(), "karan")).toMatch(/member of this team/)
    expect(assignRefusal(ctx(), "neha")).toMatch(/report to you/)
  })
})
