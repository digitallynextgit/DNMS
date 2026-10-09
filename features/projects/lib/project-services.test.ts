import { describe, expect, it } from "vitest"

import {
  PROJECT_SERVICES,
  SHORT_NAME_MAX,
  isProjectService,
  normaliseServices,
  normaliseShortName,
  serviceInfo,
  servicesText,
  shortNameProblem,
} from "./project-services"

describe("project services", () => {
  it("lists the twelve services in the agreed order, each with its own calendar", () => {
    expect(PROJECT_SERVICES.map((s) => s.label)).toEqual([
      "SMO",
      "SEO",
      "PM",
      "Email/WA/SMS",
      "Inf.",
      "All.",
      "DPR",
      "Web",
      "Camp.",
      "Offline",
      "BD",
      "Brand",
    ])
    const calendars = PROJECT_SERVICES.map((s) => s.calendar.name)
    expect(new Set(calendars).size).toBe(calendars.length)
    expect(serviceInfo("SMO")?.calendar.tabs).toEqual(["Instagram", "LinkedIn", "YouTube", "X"])
  })

  it("keeps known codes once, in catalogue order", () => {
    expect(normaliseServices(["WEB", "SMO", "WEB", "nope", 4, "PM"])).toEqual(["SMO", "PM", "WEB"])
  })

  it("treats anything that isn't a list as no services", () => {
    expect(normaliseServices(undefined)).toEqual([])
    expect(normaliseServices("SMO")).toEqual([])
  })

  it("recognises codes and describes them", () => {
    expect(isProjectService("DPR")).toBe(true)
    expect(isProjectService("dpr")).toBe(false)
    expect(serviceInfo("INF")?.name).toBe("Influencers & Collabs")
  })
})

describe("short names", () => {
  it("trims and collapses spaces; empty means none", () => {
    expect(normaliseShortName("  iMET   Global ")).toBe("iMET Global")
    expect(normaliseShortName("   ")).toBeNull()
    expect(normaliseShortName(null)).toBeNull()
  })

  it("accepts the kinds of names in use", () => {
    for (const name of ["DN", "H2S", "iSocial", "Viksit Bharat", "R&D", "Next-Gen", "A.B"]) {
      expect(shortNameProblem(name)).toBeNull()
    }
  })

  it("refuses names that are too long or start oddly", () => {
    expect(shortNameProblem("x".repeat(SHORT_NAME_MAX + 1))).toMatch(/24 characters/)
    expect(shortNameProblem("-DN")).toMatch(/letters and numbers/)
    expect(shortNameProblem("DN/2")).toMatch(/letters and numbers/)
  })

  it("writes services as text with their owners, in catalogue order", () => {
    const person = (firstName: string, lastName: string) => ({
      id: firstName,
      firstName,
      lastName,
      profilePhoto: null,
    })
    expect(
      servicesText(
        ["WEB", "SEO", "SMO"],
        [
          { service: "SEO", employee: person("Priya", "Sharma") },
          { service: "SMO", employee: person("Manpreet", "") },
        ],
      ),
    ).toBe("SMO (Manpreet), SEO (Priya Sharma), Web")
    expect(servicesText([])).toBe("")
  })
})
