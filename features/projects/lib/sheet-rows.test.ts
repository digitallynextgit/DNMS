import { describe, expect, it } from "vitest"

import { positionAfterDelete } from "./sheet-rows"

describe("positionAfterDelete", () => {
  it("moves the row under five deleted rows to the top", () => {
    const at = positionAfterDelete([0, 1, 2, 3, 4])
    expect(at(5)).toBe(0)
    expect(at(9)).toBe(4)
    expect(at(2)).toBeNull()
  })

  it("moves each row up by the deleted rows above it only", () => {
    const at = positionAfterDelete([7, 2, 2, 4])
    expect([0, 1, 3, 5, 6, 8].map(at)).toEqual([0, 1, 2, 3, 4, 5])
    expect(at(4)).toBeNull()
    expect(at(7)).toBeNull()
  })

  it("leaves everything in place when nothing is deleted", () => {
    expect(positionAfterDelete([])(12)).toBe(12)
  })
})
