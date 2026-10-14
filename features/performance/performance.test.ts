import { describe, expect, it } from "vitest"

import { BANDS_LOW_TO_HIGH, bandForPercent, scalePosition, scorePercent } from "./performance"

describe("scorePercent", () => {
  it("scales a 1 to 5 rating and keeps a 0 to 100 score", () => {
    expect(scorePercent(4.5)).toBe(90)
    expect(scorePercent(90.4)).toBe(90.4)
  })
})

describe("scalePosition", () => {
  it("runs from 0 to 100 across six equal bands", () => {
    expect(BANDS_LOW_TO_HIGH).toHaveLength(6)
    expect(scalePosition(0)).toBe(0)
    expect(scalePosition(100)).toBe(100)
    // Each band boundary sits at a sixth of the way along.
    expect(scalePosition(65)).toBeCloseTo(100 / 6)
    expect(scalePosition(95)).toBeCloseTo(500 / 6)
  })
  it("places a score inside its own band", () => {
    // 90.4 is 0.4 of the way into the 5-point Outstanding band (the 5th of 6).
    expect(scalePosition(90.4)).toBeCloseTo(((4 + 0.08) / 6) * 100)
    expect(bandForPercent(90.4)?.rating).toBe("Outstanding Performer")
    expect(scalePosition(32.5)).toBeCloseTo((0.5 / 6) * 100)
  })
  it("clamps scores outside 0 to 100", () => {
    expect(scalePosition(-5)).toBe(0)
    expect(scalePosition(120)).toBe(100)
  })
})
