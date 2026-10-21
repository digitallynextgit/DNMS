import { describe, expect, it } from "vitest"

import { reportingLine } from "./reporting-line"

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
