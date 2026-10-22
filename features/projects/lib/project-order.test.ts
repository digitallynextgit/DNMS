import { describe, expect, it } from "vitest"

import { compareProjectImportance, type RankedProject } from "./project-order"

const p = (name: string, status: string, priority: string, taskCount: number): RankedProject => ({
  name,
  status,
  priority,
  taskCount,
})

describe("compareProjectImportance", () => {
  it("puts live, high-priority, busy projects first and finished ones last", () => {
    const list = [
      p("New internal", "PLANNING", "MEDIUM", 0),
      p("Done", "COMPLETED", "HIGH", 0),
      p("Quiet", "ACTIVE", "MEDIUM", 1),
      p("Busy", "ACTIVE", "MEDIUM", 172),
      p("Key", "ACTIVE", "HIGH", 6),
      p("Paused", "ON_HOLD", "URGENT", 3),
      p("Fire", "ACTIVE", "URGENT", 2),
    ]
    expect(list.sort(compareProjectImportance).map((x) => x.name)).toEqual([
      "Fire",
      "Key",
      "Busy",
      "Quiet",
      "Paused",
      "New internal",
      "Done",
    ])
  })

  it("falls back to the name", () => {
    expect(
      [p("b", "ACTIVE", "LOW", 0), p("a", "ACTIVE", "LOW", 0)]
        .sort(compareProjectImportance)
        .map((x) => x.name),
    ).toEqual(["a", "b"])
  })
})
