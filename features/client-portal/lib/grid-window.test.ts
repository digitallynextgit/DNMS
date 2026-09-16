import { describe, expect, it } from "vitest"

import { rowAt, rowOffsets, rowWindow } from "./grid-window"

const ROW_H = 64
const uniform = (total: number) => rowOffsets(total, () => ROW_H)

describe("rowOffsets", () => {
  it("measures the whole grid, not just the rows that exist", () => {
    const offsets = uniform(100)
    expect(offsets).toHaveLength(101)
    expect(offsets[0]).toBe(0)
    expect(offsets[100]).toBe(6400)
  })

  it("honours a row the team made taller", () => {
    // Row 2 is 100px; everything after it shifts down by the extra 36.
    const offsets = rowOffsets(5, (pos) => (pos === 2 ? 100 : ROW_H))
    expect(offsets).toEqual([0, 64, 128, 228, 292, 356])
  })
})

describe("rowAt", () => {
  it("finds the row containing y when every row is the same height", () => {
    const offsets = uniform(100)
    for (const y of [0, 1, 63, 64, 65, 640, 6399]) {
      expect(rowAt(offsets, 100, y)).toBe(Math.floor(y / ROW_H))
    }
  })

  it("lands on the row that STARTS at an exact boundary, not the one that ends there", () => {
    const offsets = uniform(10)
    expect(rowAt(offsets, 10, 64)).toBe(1)
    expect(rowAt(offsets, 10, 128)).toBe(2)
  })

  it("clamps past the bottom rather than running off the end", () => {
    const offsets = uniform(10)
    expect(rowAt(offsets, 10, 999_999)).toBe(9)
  })

  it("works with mixed row heights", () => {
    const offsets = rowOffsets(5, (pos) => (pos === 2 ? 100 : ROW_H))
    expect(rowAt(offsets, 5, 127)).toBe(1)
    expect(rowAt(offsets, 5, 128)).toBe(2)
    expect(rowAt(offsets, 5, 227)).toBe(2)
    expect(rowAt(offsets, 5, 228)).toBe(3)
  })
})

describe("rowWindow", () => {
  const TOTAL = 100
  const VIEW = 600
  const OVERSCAN = 6
  const offsets = uniform(TOTAL)

  it("mounts only the visible band plus overscan", () => {
    const w = rowWindow(offsets, TOTAL, 0, VIEW, OVERSCAN)
    expect(w.firstRow).toBe(0)
    // 600px of viewport is 9 whole rows and part of a tenth, + 1 + overscan.
    expect(w.lastRow).toBe(16)
    expect(w.lastRow - w.firstRow).toBeLessThan(TOTAL)
  })

  it("keeps the total height constant however far it is scrolled", () => {
    // The scrollbar must not twitch as rows swap in and out: mounted height
    // plus both spacers has to equal the full grid at EVERY scroll position.
    for (let top = 0; top <= 6400 - VIEW; top += 37) {
      const w = rowWindow(offsets, TOTAL, top, VIEW, OVERSCAN)
      const mounted = (offsets[w.lastRow] ?? 0) - (offsets[w.firstRow] ?? 0)
      expect(w.topPad + mounted + w.bottomPad).toBe(6400)
    }
  })

  it("covers the viewport at every scroll position", () => {
    // Anything less and a strip of the grid renders blank.
    for (let top = 0; top <= 6400 - VIEW; top += 37) {
      const w = rowWindow(offsets, TOTAL, top, VIEW, OVERSCAN)
      expect(offsets[w.firstRow]!).toBeLessThanOrEqual(top)
      expect(offsets[w.lastRow]!).toBeGreaterThanOrEqual(top + VIEW)
    }
  })

  it("reaches the very last row when scrolled to the bottom", () => {
    const w = rowWindow(offsets, TOTAL, 6400 - VIEW, VIEW, OVERSCAN)
    expect(w.lastRow).toBe(TOTAL)
    expect(w.bottomPad).toBe(0)
  })

  it("mounts everything when the grid is shorter than the viewport", () => {
    const short = uniform(4)
    const w = rowWindow(short, 4, 0, VIEW, OVERSCAN)
    expect(w).toEqual({ firstRow: 0, lastRow: 4, topPad: 0, bottomPad: 0 })
  })

  it("still adds up after the client asks for another hundred rows", () => {
    const grown = uniform(200)
    const w = rowWindow(grown, 200, 12_000, VIEW, OVERSCAN)
    const mounted = (grown[w.lastRow] ?? 0) - (grown[w.firstRow] ?? 0)
    expect(w.topPad + mounted + w.bottomPad).toBe(12_800)
  })
})
