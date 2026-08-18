import "server-only"

import { db } from "@/server/db"
import { NotFoundError, ValidationError } from "@/lib/errors"
import { createNotification } from "@/lib/notifications"

// =============================================================================
// The task-edit override.
//
// Normally whoever raised a task may correct it for 15 minutes and no longer;
// after that only the team manager can (lib/edit-window.ts).
// That is right for a commitment other people plan around, and wrong when
// somebody has to write up a day they forgot to fill in, or fix last week's
// sheet before it is reported on.
//
// HR/admin lifts the window for one person, from that person's profile. It is
// deliberately narrow: it lets them correct work THEY raised. It does not let
// them touch a colleague's task, and it does not let them delete anything.
// =============================================================================

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

/**
 * Turn the override on or off.
 *
 * Always records WHO decided and when. A standing bypass of a control that
 * nobody can trace back to a person is how the control quietly stops meaning
 * anything - and the employee is told either way, because a permission that
 * changes silently is one they will not use, or will not know they lost.
 */
export async function setTaskAccess(
  employeeId: string,
  enabled: boolean,
  actorId: string,
): Promise<TaskAccessState> {
  if (employeeId === actorId) {
    // Otherwise an admin quietly widens their own permissions, which is the one
    // grant nobody else is watching.
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
      // Kept on revoke too: "granted by X, then taken away" is the history worth
      // having, and blanking it loses who ever thought it was a good idea.
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
