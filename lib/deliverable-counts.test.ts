import { describe, expect, it } from "vitest"

/** Copy of the rule in syncMadeCount (that module is server-only). Keep the two in step. */
function nextMade(made: number, before: number, after: number, quantity: number): number {
  if (made > before) return made
  return Math.max(0, Math.min(quantity, after))
}

/** Made is a floor that follows attachments: counts entered with no files must not be zeroed. */
describe("the Made count follows attachments", () => {
  it("moves up as things are attached", () => {
    expect(nextMade(0, 0, 1, 8)).toBe(1)
    expect(nextMade(7, 7, 8, 8)).toBe(8)
  })

  it("moves back down as they are removed", () => {
    expect(nextMade(8, 8, 7, 8)).toBe(7)
    expect(nextMade(1, 1, 0, 8)).toBe(0)
  })

  it("never exceeds what was planned", () => {
    // A row that collected a ninth file is still only as made as it was planned.
    expect(nextMade(8, 8, 9, 8)).toBe(8)
  })

  it("never goes negative", () => {
    expect(nextMade(0, 0, -1, 8)).toBe(0)
  })

  it("leaves a staff-entered count alone when nothing was attached", () => {
    // 5 recorded, no files. Attaching one must not drop it to 1.
    expect(nextMade(5, 0, 1, 8)).toBe(5)
  })

  it("leaves a staff count that is ahead of the files alone when one is removed", () => {
    // Two were made but never uploaded; deleting a file must not erase them.
    expect(nextMade(5, 3, 2, 8)).toBe(5)
  })

  it("tracks the attachments when the count was level with them", () => {
    expect(nextMade(3, 3, 4, 8)).toBe(4)
  })

  it("lets a row marked Made fall back when its evidence is removed", () => {
    // Marked made (full quantity), then a file is deleted: the count follows it down.
    expect(nextMade(8, 8, 7, 8)).toBe(7)
  })
})
