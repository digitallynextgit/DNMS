import { describe, expect, it } from "vitest"
import { API_ROUTES } from "../api-routes.generated"
import { ENDPOINT_DESCRIPTIONS } from "./index"

// Keeps the AI connector in step with the website: every endpoint the connector
// exposes must be described for the AI, and no description may point at an
// endpoint that no longer exists. Adding a route? Add its entry in
// features/mcp/server/descriptions/ (and run `pnpm mcp:api-map`).

const catalogued = API_ROUTES.flatMap((r) => Object.keys(r.methods).map((m) => `${m} ${r.path}`))

describe("AI connector endpoint descriptions", () => {
  it("describe every endpoint the connector exposes", () => {
    const missing = catalogued.filter((key) => !ENDPOINT_DESCRIPTIONS[key])
    expect(missing, `No description for:\n${missing.join("\n")}`).toEqual([])
  })

  it("do not describe endpoints that no longer exist", () => {
    const known = new Set(catalogued)
    const stale = Object.keys(ENDPOINT_DESCRIPTIONS).filter((key) => !known.has(key))
    expect(stale, `Stale descriptions:\n${stale.join("\n")}`).toEqual([])
  })

  it("are written as usable sentences", () => {
    const bad = Object.entries(ENDPOINT_DESCRIPTIONS)
      .filter(([, d]) => d.summary.trim().length < 15 || d.summary.length > 600)
      .map(([k]) => k)
    expect(bad).toEqual([])
  })
})
