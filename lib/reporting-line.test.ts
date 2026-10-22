import { describe, expect, it } from "vitest"

import { isManagerOf, managedBy, managerIdsOf, reportingLine } from "./reporting-line"

const row = (id: string, managerId: string | null, dottedManagerId: string | null = null) => ({
  id,
  managerId,
  dottedManagerId,
})

describe("reportingLine", () => {
  const org = [
    row("ceo", null),
    row("lead", "ceo"),
    row("dev1", "lead"),
    row("dev2", "lead"),
    row("intern", "dev1"),
    row("designer", "ceo", "lead"),
    row("other", "ceo"),
  ]

  it("includes indirect reports and dotted-line reports", () => {
    expect(reportingLine("lead", org).sort()).toEqual(["designer", "dev1", "dev2", "intern"])
  })
  it("is empty for someone nobody reports to", () => {
    expect(reportingLine("dev2", org)).toEqual([])
  })
  it("survives a management cycle", () => {
    expect(reportingLine("a", [row("a", "b"), row("b", "a")])).toEqual(["b"])
  })
})

describe("both managers", () => {
  it("lists the reporting and dotted-line manager once each", () => {
    expect(managerIdsOf({ managerId: "a", dottedManagerId: "b" })).toEqual(["a", "b"])
    expect(managerIdsOf({ managerId: "a", dottedManagerId: "a" })).toEqual(["a"])
    expect(managerIdsOf({ managerId: null, dottedManagerId: null })).toEqual([])
    expect(managerIdsOf(null)).toEqual([])
  })
  it("gives the dotted-line manager the same say", () => {
    const e = { managerId: "a", dottedManagerId: "b" }
    expect(isManagerOf(e, "a")).toBe(true)
    expect(isManagerOf(e, "b")).toBe(true)
    expect(isManagerOf(e, "c")).toBe(false)
    expect(isManagerOf(undefined, "a")).toBe(false)
  })
  it("filters on either manager", () => {
    expect(managedBy("me")).toEqual({ OR: [{ managerId: "me" }, { dottedManagerId: "me" }] })
  })
})
