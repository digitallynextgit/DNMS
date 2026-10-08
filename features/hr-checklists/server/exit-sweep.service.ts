import "server-only"

import { db } from "@/server/db"
import { createNotifications } from "@/lib/notifications"
import { setMembershipActive } from "@/server/identity"

// Backstop for unfinished exits: deactivates anyone still active after their last working day
// and tells HR. Never completes the checklist - the clearances still need real signatures.

export interface ExitSweepResult {
  checked: number
  deactivated: { employeeId: string; name: string; lastWorkingDate: string | null }[]
}

export async function sweepOverdueExits(now: Date = new Date()): Promise<ExitSweepResult> {
  // Date-only: overdue only from the day after the last working day.
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
        // Same cleanup as the normal exit path, so rosters and pickers drop the leaver.
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

  // Tell HR: a sweep firing means someone left without clearance sign-off.
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
