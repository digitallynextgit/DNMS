import { describe, expect, it } from "vitest"

import { exportFileName, sheetTable, sheetTablePart } from "./sheet-export"
import type { ProjectSheet } from "./sheet-types"

const sheet: ProjectSheet = {
  id: "s1",
  workbookId: "w1",
  name: "Dec 2026",
  description: null,
  position: 0,
  rowHeights: {},
  createdByName: null,
  updatedAt: "2026-10-12T00:00:00Z",
  columns: [
    {
      id: "b",
      name: "Owner",
      type: "PERSON",
      position: 1,
      width: null,
      options: [],
      key: null,
      locked: false,
    },
    {
      id: "a",
      name: "Date",
      type: "DATE",
      position: 0,
      width: null,
      options: [],
      key: null,
      locked: false,
    },
    {
      id: "c",
      name: "Done",
      type: "CHECKBOX",
      position: 2,
      width: null,
      options: [],
      key: null,
      locked: false,
    },
  ],
  rows: [
    { id: "r3", position: 3, cells: { a: "" }, createdByName: null, updatedAt: "" },
    {
      id: "r0",
      position: 0,
      cells: { a: "2026-12-02", b: "e1", c: true },
      createdByName: null,
      updatedAt: "",
    },
    { id: "r2", position: 2, cells: { b: "gone" }, createdByName: null, updatedAt: "" },
  ],
}

describe("sheetTable", () => {
  it("orders columns, shows names for people and keeps blank rows in place", () => {
    const t = sheetTable(sheet, (id) => (id === "e1" ? "Priya Sharma" : undefined))
    expect(t.header).toEqual(["Date", "Owner", "Done"])
    expect(t.rows).toEqual([
      ["2026-12-02", "Priya Sharma", true],
      [null, null, null],
      // Someone who left the project shows as their stored id, as in the grid.
      [null, "gone", null],
    ])
  })
})

describe("sheetTablePart", () => {
  const name = (id: string) => (id === "e1" ? "Priya Sharma" : undefined)

  it("keeps only the picked rows that have something in them", () => {
    const t = sheetTablePart(sheet, name, { positions: [2, 0, 1, 9] })
    expect(t.header).toEqual(["Date", "Owner", "Done"])
    expect(t.rows).toEqual([
      ["2026-12-02", "Priya Sharma", true],
      [null, "gone", null],
    ])
  })

  it("keeps only the picked columns, in grid order", () => {
    const t = sheetTablePart(sheet, name, { columnIds: ["c", "a"] })
    expect(t.header).toEqual(["Date", "Done"])
    // Row 2 only had an Owner, so it trails empty and is dropped.
    expect(t.rows).toEqual([["2026-12-02", true]])
  })
})

describe("exportFileName", () => {
  it("joins the parts and strips characters files can't have", () => {
    expect(exportFileName(["H2S: Calendar", "Dec 2026", "LinkedIn/Meta"], "csv")).toBe(
      "H2S Calendar - Dec 2026 - LinkedIn Meta.csv",
    )
    expect(exportFileName([null, " "], "xlsx")).toBe("Calendar.xlsx")
  })
})
