import { describe, expect, it } from "vitest"

import { exclusionReason } from "@/features/mcp/server/api-policy"
import { metricDateFilter, parseDay } from "./metric-range"

// The range the Meta Ads and Shopify dashboards are read for comes straight from the query string.

const utc = (d: string) => new Date(`${d}T00:00:00.000Z`)

describe("metricDateFilter", () => {
  it("reads an inclusive from/to span", () => {
    expect(metricDateFilter({ from: "2026-10-01", to: "2026-10-31" })).toEqual({
      gte: utc("2026-10-01"),
      lte: utc("2026-10-31"),
    })
  })

  it("reads a backwards span as the days between", () => {
    expect(metricDateFilter({ from: "2026-10-31", to: "2026-10-01" })).toEqual({
      gte: utc("2026-10-01"),
      lte: utc("2026-10-31"),
    })
  })

  it("lets an explicit span win over days", () => {
    expect(metricDateFilter({ days: 7, from: "2026-10-01", to: "2026-10-02" })).toEqual({
      gte: utc("2026-10-01"),
      lte: utc("2026-10-02"),
    })
  })

  it("widens to everything on junk instead of failing", () => {
    expect(metricDateFilter(undefined)).toBeNull()
    expect(metricDateFilter({})).toBeNull()
    expect(metricDateFilter({ days: Number.NaN })).toBeNull()
    expect(metricDateFilter({ days: -5 })).toBeNull()
    expect(metricDateFilter({ from: "2026-13-45", to: "'; DROP TABLE x" })).toBeNull()
  })

  it("counts days back from today", () => {
    const f = metricDateFilter({ days: 30 })!
    const daysBack = (Date.now() - f.gte!.getTime()) / 86_400_000
    expect(daysBack).toBeGreaterThanOrEqual(30)
    expect(daysBack).toBeLessThan(31)
    expect(f.lte).toBeUndefined()
  })
})

describe("parseDay", () => {
  it("takes only yyyy-MM-dd", () => {
    expect(parseDay("2026-11-02")).toEqual(utc("2026-11-02"))
    expect(parseDay("2026-11-2")).toBeNull()
    expect(parseDay("2026-11-02T00:00:00Z")).toBeNull()
    expect(parseDay("")).toBeNull()
  })
})

describe("AI connector reach", () => {
  it("can read Shopify sales but never the stored token", () => {
    expect(
      exclusionReason("/api/projects/[id]/integration/shopify/credentials", "GET"),
    ).not.toBeNull()
    expect(exclusionReason("/api/projects/[id]/integration/shopify", "GET")).toBeNull()
    expect(exclusionReason("/api/cron/shopify-sync", "GET")).not.toBeNull()
  })
})
