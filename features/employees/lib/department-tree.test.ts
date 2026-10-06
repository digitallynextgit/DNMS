import { describe, expect, it } from "vitest"
import {
  departmentDepth,
  departmentDescendantIds,
  departmentParentError,
  departmentSubtreeHeight,
  flattenDepartmentTree,
} from "./department-tree"

// SMG → { BSG, MSG → { SMO, Content } }, AMG, HR
const TREE = [
  { id: "hr", name: "HR & Admin", parentId: null },
  { id: "smg", name: "SMG", parentId: null },
  { id: "msg", name: "MSG", parentId: "smg" },
  { id: "bsg", name: "BSG", parentId: "smg" },
  { id: "smo", name: "SMO", parentId: "msg" },
  { id: "content", name: "Content", parentId: "msg" },
  { id: "amg", name: "AMG", parentId: null },
]

describe("flattenDepartmentTree", () => {
  it("lists each department before its sub-departments, siblings alphabetical", () => {
    expect(flattenDepartmentTree(TREE).map((d) => d.id)).toEqual([
      "amg",
      "hr",
      "smg",
      "bsg",
      "msg",
      "content",
      "smo",
    ])
  })

  it("gives depth, path label, outline number and child count", () => {
    const content = flattenDepartmentTree(TREE).find((d) => d.id === "content")!
    expect(content.depth).toBe(2)
    expect(content.label).toBe("SMG › MSG › Content")
    expect(content.outline).toBe("3.2.1")
    const msg = flattenDepartmentTree(TREE).find((d) => d.id === "msg")!
    expect(msg.childCount).toBe(2)
  })

  it("shows a department whose parent is missing as top level", () => {
    const flat = flattenDepartmentTree([{ id: "a", name: "A", parentId: "gone" }])
    expect(flat).toHaveLength(1)
    expect(flat[0]!.depth).toBe(0)
  })

  it("skips a parent loop instead of recursing forever", () => {
    const flat = flattenDepartmentTree([
      { id: "a", name: "A", parentId: "b" },
      { id: "b", name: "B", parentId: "a" },
      { id: "c", name: "C", parentId: null },
    ])
    expect(flat.map((d) => d.id)).toEqual(["c"])
  })
})

describe("tree measurements", () => {
  it("finds every descendant", () => {
    expect([...departmentDescendantIds(TREE, "smg")].sort()).toEqual(
      ["bsg", "content", "msg", "smo"].sort(),
    )
    expect(departmentDescendantIds(TREE, "smo").size).toBe(0)
  })

  it("measures depth and subtree height", () => {
    expect(departmentDepth(TREE, "smg")).toBe(0)
    expect(departmentDepth(TREE, "content")).toBe(2)
    expect(departmentSubtreeHeight(TREE, "smg")).toBe(3)
    expect(departmentSubtreeHeight(TREE, "msg")).toBe(2)
    expect(departmentSubtreeHeight(TREE, "hr")).toBe(1)
  })
})

describe("departmentParentError", () => {
  it("allows top level and up to three levels", () => {
    expect(departmentParentError(TREE, null, null)).toBeNull()
    expect(departmentParentError(TREE, null, "msg")).toBeNull() // new sub-sub-department
    expect(departmentParentError(TREE, "hr", "smg")).toBeNull()
  })

  it("refuses a fourth level", () => {
    expect(departmentParentError(TREE, null, "content")).toMatch(/3 levels/)
    // MSG brings its own level below it: under BSG it would reach four.
    expect(departmentParentError(TREE, "msg", "bsg")).toMatch(/3 levels/)
  })

  it("refuses loops", () => {
    expect(departmentParentError(TREE, "smg", "smg")).toMatch(/itself/)
    expect(departmentParentError(TREE, "smg", "content")).toMatch(/itself/)
  })

  it("refuses an unknown parent", () => {
    expect(departmentParentError(TREE, null, "nope")).toMatch(/not found/)
  })
})
