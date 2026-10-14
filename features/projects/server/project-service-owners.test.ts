import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Session } from "next-auth"

vi.mock("server-only", () => ({}))

// One project with SEO; "am" is its Account Manager; "a", "b", "c" sit on its teams, "out" does not.
interface Row {
  employeeId: string
  secondaryEmployeeId: string | null
}
let row: Row | null = null
const written: (Row | null)[] = []
/** What the service's calendars were given: manager, and secondary (undefined = left as it was). */
const synced: { manager: string | null; secondary?: string | null }[] = []

vi.mock("@/server/db", () => {
  const tx = {
    projectServiceOwner: {
      deleteMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async ({ data }: { data: Row }) => {
        written.push({ employeeId: data.employeeId, secondaryEmployeeId: data.secondaryEmployeeId })
        return data
      }),
    },
  }
  return {
    db: {
      project: {
        findUnique: vi.fn(async () => ({
          services: ["SEO"],
          ownerId: "am",
          secondaryAccountManagerId: null,
        })),
      },
      projectServiceOwner: {
        findUnique: vi.fn(async () => row),
      },
      projectTeamMember: {
        count: vi.fn(async ({ where }: { where: { employeeId: string } }) =>
          ["a", "b", "c"].includes(where.employeeId) ? 1 : 0,
        ),
      },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => {
        written.push(null)
        await fn(tx)
      }),
    },
  }
})
vi.mock("./service-calendars", () => ({
  syncServiceCalendarManager: vi.fn(
    async (_p: string, _s: string, manager: string | null, secondary?: string | null) => {
      synced.push({ manager, secondary })
    },
  ),
}))
vi.mock("./sheets.service", () => ({ parsePeriodMonth: () => new Date("2026-10-01") }))
let manager = false
vi.mock("./project-access", () => ({ canManageProject: vi.fn(async () => manager) }))

import {
  ServiceOwnerError,
  assertMayChangeServiceOwners,
  setServiceOwners,
} from "./project-service-owners"

const as = (id: string) => ({ user: { id } }) as unknown as Session
/** The row as last written (null = the service was left unowned). */
const saved = () => written.at(-1)

async function refused(p: Promise<unknown>, status: number) {
  const err = await p.catch((e: unknown) => e)
  expect(err).toBeInstanceOf(ServiceOwnerError)
  expect((err as ServiceOwnerError).status).toBe(status)
}

beforeEach(() => {
  row = { employeeId: "a", secondaryEmployeeId: null }
  written.length = 0
  synced.length = 0
  manager = false
})

describe("setServiceOwners", () => {
  it("adds a secondary owner, who covers the service's calendars under the same manager", async () => {
    const assigned = await setServiceOwners("p", "SEO", { secondary: "b" })
    expect(saved()).toEqual({ employeeId: "a", secondaryEmployeeId: "b" })
    expect(assigned).toEqual([{ employeeId: "b", secondary: true }])
    expect(synced).toEqual([{ manager: "a", secondary: "b" }])
  })

  it("moves the secondary up when the owner is cleared, calendars and all", async () => {
    row = { employeeId: "a", secondaryEmployeeId: "b" }
    await setServiceOwners("p", "SEO", { primary: null })
    expect(saved()).toEqual({ employeeId: "b", secondaryEmployeeId: null })
    expect(synced).toEqual([{ manager: "b", secondary: null }])
  })

  it("empties the secondary slot when the secondary is made the owner", async () => {
    row = { employeeId: "a", secondaryEmployeeId: "b" }
    await setServiceOwners("p", "SEO", { primary: "b" })
    expect(saved()).toEqual({ employeeId: "b", secondaryEmployeeId: null })
  })

  it("refuses a secondary who is the owner, or with no owner at all", async () => {
    await refused(setServiceOwners("p", "SEO", { secondary: "a" }), 422)
    row = null
    await refused(setServiceOwners("p", "SEO", { secondary: "b" }), 422)
  })

  it("keeps owners to people on the project (an Account Manager counts)", async () => {
    await refused(setServiceOwners("p", "SEO", { secondary: "out" }), 422)
    await setServiceOwners("p", "SEO", { secondary: "am" })
    expect(saved()).toEqual({ employeeId: "a", secondaryEmployeeId: "am" })
  })
})

describe("assertMayChangeServiceOwners", () => {
  it("lets the owner pick their own secondary, but not change the owner", async () => {
    await expect(
      assertMayChangeServiceOwners(as("a"), "p", "SEO", { secondary: "b" }),
    ).resolves.toBeUndefined()
    await refused(assertMayChangeServiceOwners(as("a"), "p", "SEO", { primary: "b" }), 403)
  })

  it("keeps everyone else out, and lets an Account Manager or admin do both", async () => {
    await refused(assertMayChangeServiceOwners(as("c"), "p", "SEO", { secondary: "c" }), 403)
    manager = true
    await expect(
      assertMayChangeServiceOwners(as("am"), "p", "SEO", { primary: "c", secondary: "b" }),
    ).resolves.toBeUndefined()
  })
})
