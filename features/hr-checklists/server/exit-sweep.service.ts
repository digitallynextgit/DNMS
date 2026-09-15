import "server-only"

import { db } from "@/server/db"
import { createNotifications } from "@/lib/notifications"
import { setMembershipActive } from "@/server/identity"

// =============================================================================
// The backstop for an exit nobody finished.
// =============================================================================
// Approval no longer deactivates anybody - it starts a notice period, and the
// account closes at HR's final sign-off. That is the right shape, but it moves
// the close from something guaranteed (a transaction) to something a person has
// to remember, and the failure mode is severe: a departed employee keeps a
// working login indefinitely.
//
// This sweep is what makes the notice period safe to have. Anyone whose last
// working day has PASSED and who is somehow still active is deactivated, and HR
// is told their clearance was never completed.
//
// It never completes the checklist. The clearances still have to be signed by
// the people who owe them, and marking an exit "done" because a date went by
// would forge exactly the record the gate exists to protect.
// =============================================================================

export interface ExitSweepResult {
  checked: number
  deactivated: { employeeId: string; name: string; lastWorkingDate: string | null }[]
}

export async function sweepOverdueExits(now: Date = new Date()): Promise<ExitSweepResult> {
  // Date-only: the last working day is itself a working day, so somebody is
  // only overdue from the day AFTER it.
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const overdue = await db.resignation.findMany({
    where: {
      status: "APPROVED",
      requestedLastWorkingDate: { lt: cutoff },
      employee: { isActive: true },
    },
    select: {
      requestedLastWorkingDate: true,
      employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
    },
  })

  const result: ExitSweepResult = { checked: overdue.length, deactivated: [] }
  if (overdue.length === 0) return result

  for (const row of overdue) {
    const e = row.employee
    try {
      await db.$transaction([
        db.employee.update({
          where: { id: e.id },
          data: { status: "RESIGNED", isActive: false },
        }),
        // Same cleanup the deliberate paths perform - rosters and pickers must
        // stop treating a leaver as current.
        db.projectTeamMember.deleteMany({ where: { employeeId: e.id } }),
        db.projectTeam.updateMany({ where: { managerId: e.id }, data: { managerId: null } }),
      ])
      try {
        await setMembershipActive({ employeeId: e.id }, false)
      } catch (err) {
        console.error("[exit-sweep] membership deactivation failed", e.id, err)
      }
      result.deactivated.push({
        employeeId: e.id,
        name: `${e.firstName} ${e.lastName}`.trim(),
        lastWorkingDate: row.requestedLastWorkingDate?.toISOString().slice(0, 10) ?? null,
      })
    } catch (err) {
      // One stuck employee must not stop the sweep for everybody else.
      console.error("[exit-sweep] failed for", e.id, err)
    }
  }

  // Tell HR, because a sweep firing means the process was not followed: these
  // people left without their clearance being signed off.
  if (result.deactivated.length > 0) {
    const hr = await db.employee.findMany({
      where: {
        isActive: true,
        employeeRoles: { some: { role: { name: { in: ["hr_manager", "admin"] } } } },
      },
      select: { id: true },
    })
    if (hr.length > 0) {
      const names = result.deactivated.map((d) => d.name).join(", ")
      await createNotifications(
        hr.map((h) => ({
          employeeId: h.id,
          title: "Exit closed without clearance",
          message: `${result.deactivated.length} account${
            result.deactivated.length === 1 ? "" : "s"
          } past the last working day were deactivated with the exit clearance unfinished: ${names}.`,
          type: "warning" as const,
          link: "/exit-clearance",
        })),
      )
    }
  }

  return result
}
