import "server-only"

import { db } from "@/server/db"
import { NotFoundError, ValidationError } from "@/lib/errors"
import { createNotification } from "@/lib/notifications"

// Task-edit override: lifts the 15-minute edit window (lib/edit-window.ts) for one person, so
// they can correct tasks THEY raised - never a colleague's, and never delete.

/** Does this person currently have the window lifted? */
export async function hasPastTaskAccess(employeeId: string): Promise<boolean> {
  const e = await db.employee.findUnique({
    where: { id: employeeId },
    select: { canEditPastTasks: true },
  })
  return e?.canEditPastTasks ?? false
}

export interface TaskAccessState {
  canEditPastTasks: boolean
  grantedAt: string | null
  grantedBy: { id: string; name: string } | null
}

export async function getTaskAccess(employeeId: string): Promise<TaskAccessState> {
  const e = await db.employee.findUnique({
    where: { id: employeeId },
    select: {
      canEditPastTasks: true,
      pastTaskAccessGrantedAt: true,
      pastTaskAccessGrantedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })
  if (!e) throw new NotFoundError("Employee")
  return {
    canEditPastTasks: e.canEditPastTasks,
    grantedAt: e.pastTaskAccessGrantedAt?.toISOString() ?? null,
    grantedBy: e.pastTaskAccessGrantedBy
      ? {
          id: e.pastTaskAccessGrantedBy.id,
          name: `${e.pastTaskAccessGrantedBy.firstName} ${e.pastTaskAccessGrantedBy.lastName}`.trim(),
        }
      : null,
  }
}

/** Turn the override on or off; always records who decided, and the employee is told. */
export async function setTaskAccess(
  employeeId: string,
  enabled: boolean,
  actorId: string,
): Promise<TaskAccessState> {
  if (employeeId === actorId) {
    // Otherwise an admin could quietly widen their own permissions.
    throw new ValidationError(
      "You cannot change your own task-edit access. Ask another admin to do it.",
    )
  }

  const target = await db.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, canEditPastTasks: true },
  })
  if (!target) throw new NotFoundError("Employee")
  if (target.canEditPastTasks === enabled) return getTaskAccess(employeeId)

  await db.employee.update({
    where: { id: employeeId },
    data: {
      canEditPastTasks: enabled,
      // Kept on revoke too, so the history shows who granted it.
      pastTaskAccessGrantedAt: new Date(),
      pastTaskAccessGrantedById: actorId,
    },
  })

  await createNotification({
    employeeId,
    title: enabled ? "You can now edit past tasks" : "Past-task editing turned off",
    message: enabled
      ? "HR has lifted the 15-minute edit window on tasks you raised, so you can go back and correct earlier days."
      : "The 15-minute edit window now applies again to tasks you raise. Ask your manager to change anything older.",
    type: "info",
    link: "/projects/my-tasks",
  })

  return getTaskAccess(employeeId)
}
