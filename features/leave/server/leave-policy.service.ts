import "server-only"

import { db } from "@/server/db"
import { PERMISSIONS } from "@/lib/constants"
import { requirePermission } from "@/server/action-guard"
import { createAuditLog } from "@/lib/audit"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"

// Company-wide leave policy is gated by `leave:policy`, not a hardcoded role
// list. It previously required HR Manager or Admin literally, which meant the
// Roles & Permissions UI could never grant or revoke it - the toggle was a lie.
// `leave:policy` is granted to exactly those roles, so access is unchanged.

// =============================================================================
// Leave policy matrix: (employmentType -> leaveType -> daysPerYear)
// =============================================================================

const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"] as const
type EmploymentTypeKey = (typeof EMPLOYMENT_TYPES)[number]

/** Leave types + the full policy grid (for the HR matrix editor). */
export async function getLeavePolicies(): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.LEAVE_POLICY)
    const [types, policies] = await Promise.all([
      db.leaveType.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          code: true,
          maxDaysPerYear: true,
          accrualMethod: true,
        },
      }),
      db.leavePolicy.findMany(),
    ])
    return ok(serialize({ data: { types, policies, employmentTypes: EMPLOYMENT_TYPES } }))
  })
}

/** Upsert a batch of policy cells. Empty/negative daysPerYear clears the cell. */
export async function saveLeavePolicies(
  entries: Array<{ employmentType: string; leaveTypeId: string; daysPerYear: number | null }>,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.LEAVE_POLICY)
    if (!Array.isArray(entries)) return fail("entries must be an array")

    for (const e of entries) {
      if (!e.leaveTypeId || !EMPLOYMENT_TYPES.includes(e.employmentType as EmploymentTypeKey))
        return fail("Each entry needs a valid leaveTypeId and employmentType")
    }

    await db.$transaction(
      entries.map((e) => {
        const employmentType = e.employmentType as EmploymentTypeKey
        // null / negative => remove the explicit cell (falls back to maxDaysPerYear).
        if (e.daysPerYear === null || e.daysPerYear === undefined || Number(e.daysPerYear) < 0) {
          return db.leavePolicy.deleteMany({
            where: { employmentType, leaveTypeId: e.leaveTypeId },
          })
        }
        const days = Number(e.daysPerYear)
        return db.leavePolicy.upsert({
          where: {
            employmentType_leaveTypeId: { employmentType, leaveTypeId: e.leaveTypeId },
          },
          update: { daysPerYear: days },
          create: { employmentType, leaveTypeId: e.leaveTypeId, daysPerYear: days },
        })
      }),
    )

    await createAuditLog(session, {
      action: "UPDATE",
      module: "leave",
      entityType: "LeavePolicy",
      changes: { count: entries.length },
    })

    const policies = await db.leavePolicy.findMany()
    return ok(serialize({ data: policies }))
  })
}
