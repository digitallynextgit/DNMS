import { describe, expect, it } from "vitest"

import { parseKeyList, sortRows, spreadsheetSafe } from "./data-table"

describe("sortRows", () => {
  const rows = [{ v: "b10" }, { v: null }, { v: "b2" }, { v: "a" }]

  it("sorts text naturally and keeps blanks last", () => {
    expect(sortRows(rows, (r) => r.v, "asc").map((r) => r.v)).toEqual(["a", "b2", "b10", null])
    expect(sortRows(rows, (r) => r.v, "desc").map((r) => r.v)).toEqual(["b10", "b2", "a", null])
  })

  it("sorts numbers as numbers and leaves the input alone", () => {
    const nums = [{ n: 10 }, { n: 9 }, { n: 100 }]
    expect(sortRows(nums, (r) => r.n, "asc").map((r) => r.n)).toEqual([9, 10, 100])
    expect(nums.map((r) => r.n)).toEqual([10, 9, 100])
  })
})

describe("spreadsheetSafe", () => {
  it("defuses formulas but keeps negative numbers and plain text", () => {
    expect(spreadsheetSafe("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)")
    expect(spreadsheetSafe("+91 98")).toBe("'+91 98")
    expect(spreadsheetSafe("@sum")).toBe("'@sum")
    expect(spreadsheetSafe("-cmd")).toBe("'-cmd")
    expect(spreadsheetSafe("-12.5")).toBe("-12.5")
    expect(spreadsheetSafe("Priya")).toBe("Priya")
    expect(spreadsheetSafe(-3)).toBe(-3)
    expect(spreadsheetSafe(null)).toBeNull()
  })
})

describe("parseKeyList", () => {
  it("reads a JSON list of strings and ignores anything else", () => {
    expect([...parseKeyList('["a","b",3]')]).toEqual(["a", "b"])
    expect(parseKeyList("nope").size).toBe(0)
    expect(parseKeyList('{"a":1}').size).toBe(0)
  })
})
