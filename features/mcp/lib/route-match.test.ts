import { describe, expect, it } from "vitest"
import { compilePatterns, matchPattern } from "./route-match"
import { exclusionReason } from "../server/api-policy"

const paths = [
  "/api/leave/requests",
  "/api/leave/requests/[id]",
  "/api/leave/team",
  "/api/leave/[id]",
  "/api/projects/[id]/tasks",
  "/api/files/[...slug]",
  "/api/docs/[[...opt]]",
]
const compiled = compilePatterns(paths, (p) => p)

describe("matchPattern", () => {
  it("matches a static route exactly", () => {
    expect(matchPattern(compiled, "/api/leave/requests")?.value).toBe("/api/leave/requests")
  })

  it("prefers a static segment over a dynamic one", () => {
    expect(matchPattern(compiled, "/api/leave/team")?.value).toBe("/api/leave/team")
    expect(matchPattern(compiled, "/api/leave/abc")).toEqual({
      value: "/api/leave/[id]",
      params: { id: "abc" },
    })
  })

  it("extracts and decodes dynamic params", () => {
    expect(matchPattern(compiled, "/api/projects/p%201/tasks")).toEqual({
      value: "/api/projects/[id]/tasks",
      params: { id: "p 1" },
    })
  })

  it("handles catch-all and optional catch-all", () => {
    expect(matchPattern(compiled, "/api/files/a/b")?.params).toEqual({ slug: ["a", "b"] })
    expect(matchPattern(compiled, "/api/files")).toBeNull()
    expect(matchPattern(compiled, "/api/docs")?.params).toEqual({ opt: [] })
  })

  it("does not match longer or shorter paths", () => {
    expect(matchPattern(compiled, "/api/projects/1/tasks/2")).toBeNull()
    expect(matchPattern(compiled, "/api/projects/1")).toBeNull()
  })
})

describe("exclusionReason (AI connector policy)", () => {
  it("blocks the platform / superadmin surface", () => {
    expect(exclusionReason("/api/settings")).toMatch(/superadmin/)
    expect(exclusionReason("/api/admin/storage-accounts/[accountId]")).toMatch(/superadmin/)
  })

  it("blocks machine, sign-in and connector endpoints", () => {
    for (const p of ["/api/cron/birthdays", "/api/auth/[...nextauth]", "/api/password", "/api/oauth/token", "/api/mcp", "/api/portal/overview", "/api/chat/stream"]) {
      expect(exclusionReason(p)).not.toBeNull()
    }
  })

  it("blocks only the secret-revealing METHOD of the vault", () => {
    expect(exclusionReason("/api/projects/[id]/passwords/[entryId]", "GET")).toMatch(/secret/)
    expect(exclusionReason("/api/projects/[id]/passwords/[entryId]", "DELETE")).toBeNull()
  })

  it("allows ordinary HR modules", () => {
    for (const p of ["/api/leave/requests", "/api/payroll/records", "/api/employees/[id]", "/api/projects/[id]/tasks"]) {
      expect(exclusionReason(p, "GET")).toBeNull()
    }
  })
})
