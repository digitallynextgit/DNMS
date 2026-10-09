import { describe, expect, it } from "vitest"

import {
  ACCOUNT_MANAGER_TEAM,
  PROJECT_TEAMS,
  TEAMS_ARE_FIXED,
  sortProjectTeams,
} from "./project-teams"

describe("project team catalogue", () => {
  it("is the eleven fixed teams, in display order", () => {
    expect(PROJECT_TEAMS).toEqual([
      "AM",
      "WEB",
      "DESIGN",
      "VIDEO",
      "CONTENT",
      "SMO",
      "SEO",
      "PERFORMANCE",
      "PR",
      "ALLIANCES & PARTNERSHIPS",
      "ADMIN",
    ])
  })

  it("has the Account Manager team in the catalogue", () => {
    expect(PROJECT_TEAMS).toContain(ACCOUNT_MANAGER_TEAM)
  })

  it("names every team in the refusal message", () => {
    for (const name of PROJECT_TEAMS) expect(TEAMS_ARE_FIXED).toContain(name)
  })

  it("sorts teams into catalogue order, legacy names last A-Z", () => {
    const sorted = sortProjectTeams([
      { name: "ZZZ" },
      { name: "ADMIN" },
      { name: "WEB" },
      { name: "CONTENT" },
      { name: "MAP" },
      { name: "AM" },
    ])
    expect(sorted.map((t) => t.name)).toEqual(["AM", "WEB", "CONTENT", "ADMIN", "MAP", "ZZZ"])
  })

  it("returns a new array and leaves the input alone", () => {
    const input = [{ name: "ADMIN" }, { name: "WEB" }]
    const sorted = sortProjectTeams(input)
    expect(sorted).not.toBe(input)
    expect(input.map((t) => t.name)).toEqual(["ADMIN", "WEB"])
  })
})
