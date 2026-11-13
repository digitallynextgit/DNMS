import { describe, expect, it } from "vitest"

import {
  changePercent,
  formatMetricValue,
  healthOf,
  movedWell,
  shiftWeek,
  STANDARD_METRICS,
  weekLabel,
  weekStartOf,
} from "./metrics"

describe("weekStartOf", () => {
  it("returns the Monday of that week", () => {
    expect(weekStartOf("2026-11-13")).toBe("2026-11-09") // Friday
    expect(weekStartOf("2026-11-09")).toBe("2026-11-09") // Monday itself
  })

  it("treats Sunday as the end of its week, not the start of the next", () => {
    expect(weekStartOf("2026-11-15")).toBe("2026-11-09")
  })
})

describe("shiftWeek / weekLabel", () => {
  it("steps whole weeks and across a month boundary", () => {
    expect(shiftWeek("2026-11-09", -1)).toBe("2026-11-02")
    expect(shiftWeek("2026-11-30", 1)).toBe("2026-12-07")
  })

  it("names the week, repeating the month only when it changes", () => {
    expect(weekLabel("2026-11-09")).toBe("9 - 15 Nov 2026")
    expect(weekLabel("2026-11-30")).toBe("30 Nov - 6 Dec 2026")
  })
})

describe("formatMetricValue", () => {
  it("writes each unit its own way", () => {
    expect(formatMetricValue(19396, "CURRENCY")).toBe("₹19,396")
    expect(formatMetricValue(0.65, "PERCENT")).toBe("0.65%")
    expect(formatMetricValue(3.5, "RATIO")).toBe("3.5x")
    expect(formatMetricValue(6, "COUNT")).toBe("6")
    expect(formatMetricValue(null, "COUNT")).toBe("-")
  })
})

describe("changePercent", () => {
  it("measures against the earlier week", () => {
    expect(changePercent(19396, 59438)).toBeCloseTo(-67.37, 1)
    expect(changePercent(12, 6)).toBe(100)
  })

  it("gives nothing when it cannot be read", () => {
    expect(changePercent(5, 0)).toBeNull()
    expect(changePercent(null, 10)).toBeNull()
  })
})

describe("healthOf", () => {
  it("passes a value inside its band", () => {
    expect(healthOf(2, { healthyMin: 1.5, healthyMax: 3 })).toBe("good")
  })

  it("warns inside a two-ended band and fails an open one", () => {
    expect(healthOf(1, { healthyMin: 1.5, healthyMax: 3 })).toBe("warn")
    expect(healthOf(2, { healthyMin: 3 })).toBe("bad")
  })

  it("says nothing without a band or a value", () => {
    expect(healthOf(5, {})).toBe("unknown")
    expect(healthOf(null, { healthyMin: 1 })).toBe("unknown")
  })
})

describe("movedWell", () => {
  it("knows which way is up for this metric", () => {
    expect(movedWell(10, 8, "UP")).toBe(true)
    expect(movedWell(7.2, 7.5, "DOWN")).toBe(true) // average position: lower is better
    expect(movedWell(7.9, 7.5, "DOWN")).toBe(false)
  })

  it("has no opinion when nothing moved", () => {
    expect(movedWell(5, 5, "UP")).toBeNull()
    expect(movedWell(null, 5, "UP")).toBeNull()
  })
})

describe("STANDARD_METRICS", () => {
  it("splits the paired rows so every metric holds one number", () => {
    const names = STANDARD_METRICS.map((m) => m.name)
    for (const n of ["Revenue", "Orders", "CTR", "Average position", "Reach", "Engagement rate"]) {
      expect(names).toContain(n)
    }
    expect(names.some((n) => n.includes("/"))).toBe(false)
  })

  it("is unique on channel + name, which the table keys on", () => {
    const keys = STANDARD_METRICS.map((m) => `${m.channel}|${m.name}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
