import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Session } from "next-auth"

vi.mock("server-only", () => ({}))

// Active employees; "gone" has left.
const PEOPLE = ["am", "am2", "x"].map((id) => ({ id, isActive: true }))
vi.mock("@/server/db", () => ({
  db: {
    employee: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        [...PEOPLE, { id: "gone", isActive: false }].filter((p) => where.id.in.includes(p.id)),
      ),
    },
  },
}))

let admin = false
vi.mock("@/lib/permissions", () => ({ hasPermission: () => admin }))

import { LeadChangeError, leadInputFrom, planLeadChange } from "./project-leads.service"
import { accountManagerIds, isProjectLead, leadRolesOf } from "../lib/project-leads"

const as = (id: string) => ({ user: { id } }) as unknown as Session

const PROJECT = { ownerId: "am", secondaryAccountManagerId: null as string | null }

async function refused(p: Promise<unknown>, status: number) {
  const err = await p.catch((e: unknown) => e)
  expect(err).toBeInstanceOf(LeadChangeError)
  expect((err as LeadChangeError).status).toBe(status)
  return (err as LeadChangeError).message
}

beforeEach(() => {
  admin = false
})

describe("planLeadChange - who may change the Account Managers", () => {
  it("lets the Account Manager pick their own secondary", async () => {
    const r = await planLeadChange(as("am"), PROJECT, { SECONDARY_ACCOUNT_MANAGER: "am2" })
    expect(r.data).toEqual({ secondaryAccountManagerId: "am2" })
    expect(r.assigned).toEqual([{ role: "SECONDARY_ACCOUNT_MANAGER", employeeId: "am2" }])
  })

  it("lets the Account Manager or an admin hand the project over, but nobody else", async () => {
    const handover = await planLeadChange(as("am"), PROJECT, { ACCOUNT_MANAGER: "x" })
    expect(handover.data).toEqual({ ownerId: "x" })
    await refused(planLeadChange(as("x"), PROJECT, { ACCOUNT_MANAGER: "x" }), 403)
    admin = true
    const r = await planLeadChange(as("admin"), PROJECT, { ACCOUNT_MANAGER: "x" })
    expect(r.data).toEqual({ ownerId: "x" })
  })

  it("keeps the secondary from taking over the project", async () => {
    await refused(
      planLeadChange(
        as("am2"),
        { ...PROJECT, secondaryAccountManagerId: "am2" },
        {
          ACCOUNT_MANAGER: "am2",
        },
      ),
      403,
    )
  })

  it("keeps the secondary from changing their own slot", async () => {
    const msg = await refused(
      planLeadChange(
        as("am2"),
        { ...PROJECT, secondaryAccountManagerId: "am2" },
        {
          SECONDARY_ACCOUNT_MANAGER: null,
        },
      ),
      403,
    )
    expect(msg).toMatch(/Account Manager or a project admin/)
  })

  it("treats a resend of the current values as no change, so the secondary may save the form", async () => {
    const r = await planLeadChange(
      as("am2"),
      { ...PROJECT, secondaryAccountManagerId: "am2" },
      { ACCOUNT_MANAGER: "am", SECONDARY_ACCOUNT_MANAGER: "am2" },
    )
    expect(r).toEqual({ data: {}, assigned: [] })
  })
})

describe("planLeadChange - checks", () => {
  it("refuses someone who has left, or who isn't in this company", async () => {
    const gone = planLeadChange(as("am"), PROJECT, { SECONDARY_ACCOUNT_MANAGER: "gone" })
    expect(await refused(gone, 422)).toMatch(/not an active employee/)
    const nobody = planLeadChange(as("am"), PROJECT, { SECONDARY_ACCOUNT_MANAGER: "nobody" })
    expect(await refused(nobody, 422)).toMatch(/not found/)
  })

  it("refuses the same person as primary and secondary", async () => {
    await refused(planLeadChange(as("am"), PROJECT, { SECONDARY_ACCOUNT_MANAGER: "am" }), 422)
  })

  it("empties the secondary slot when the secondary is promoted", async () => {
    admin = true
    const r = await planLeadChange(
      as("admin"),
      { ...PROJECT, secondaryAccountManagerId: "am2" },
      { ACCOUNT_MANAGER: "am2" },
    )
    expect(r.data).toEqual({ ownerId: "am2", secondaryAccountManagerId: null })
  })

  it("lets the secondary be cleared", async () => {
    const r = await planLeadChange(
      as("am"),
      { ...PROJECT, secondaryAccountManagerId: "am2" },
      { SECONDARY_ACCOUNT_MANAGER: null },
    )
    expect(r.data).toEqual({ secondaryAccountManagerId: null })
    expect(r.assigned).toEqual([])
  })
})

describe("leadInputFrom", () => {
  it("never clears the primary, accepts ownerId for it, and clears the secondary on null", () => {
    expect(leadInputFrom({ ownerId: "x", secondaryAccountManagerId: "" })).toEqual({
      ACCOUNT_MANAGER: "x",
      SECONDARY_ACCOUNT_MANAGER: null,
    })
    expect(leadInputFrom({ accountManagerId: null })).toEqual({
      ACCOUNT_MANAGER: undefined,
      SECONDARY_ACCOUNT_MANAGER: undefined,
    })
  })
})

describe("project-leads helpers", () => {
  const both = { ownerId: "am", secondaryAccountManagerId: "am2" }

  it("treats both Account Managers as leads, and nobody else", () => {
    expect(isProjectLead(both, "am")).toBe(true)
    expect(isProjectLead(both, "am2")).toBe(true)
    expect(isProjectLead(both, "x")).toBe(false)
    expect(accountManagerIds(both)).toEqual(["am", "am2"])
    expect(accountManagerIds({ ownerId: "am", secondaryAccountManagerId: null })).toEqual(["am"])
  })

  it("names the role someone holds", () => {
    expect(leadRolesOf(both, "am2")).toEqual(["SECONDARY_ACCOUNT_MANAGER"])
  })
})
