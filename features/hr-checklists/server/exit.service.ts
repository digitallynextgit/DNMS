import "server-only"

import { db } from "@/server/db"
import { createAuditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"
import { addEmailJob } from "@/lib/queue"
import { setMembershipActive } from "@/server/identity"
import { requirePermission, getAuditMeta } from "@/server/action-guard"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { PERMISSIONS } from "@/lib/constants"
import { wrapEmail, detailRow } from "@/lib/email-layout"
import { toDateOnly } from "@/lib/dates"
import { canComplete, type ChecklistItemState } from "../lib/checklist-rules"

// =============================================================================
// Finishing an exit.
// =============================================================================
// Separate from checklists.service.ts because completing an EXIT is not the same
// kind of act as completing an onboarding: it issues the relieving letter and
// CLOSES THE ACCOUNT. It is the one place where the document's rule - "until all
// department clearances are signed, relieving will not be issued" - stops being
// a sentence in a Word file and becomes a refusal.
// =============================================================================

/**
 * HR's final sign-off.
 *
 * Refuses while any REQUIRED clearance is unsigned, naming the ones outstanding
 * so the message says what to go and get rather than only that it is not
 * allowed.
 *
 * On success, in one transaction: close the checklist, mark the employee
 * RESIGNED and inactive, and clear their project-team seats. That last part
 * matters and was missing from the old approve-and-deactivate path - somebody
 * who has left must stop appearing in rosters, pickers and Drive sharing. Their
 * tasks and deliverables keep pointing at them, because that is the history.
 */
export async function completeExitChecklist(instanceId: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.EXIT_WRITE)

    const instance = await db.checklistInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        kind: true,
        status: true,
        employeeId: true,
        anchorDate: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeNo: true,
            isActive: true,
            status: true,
            designation: { select: { title: true } },
            department: { select: { name: true } },
            manager: { select: { email: true } },
          },
        },
        items: { select: { id: true, text: true, itemKind: true, isRequired: true, isDone: true } },
      },
    })
    if (!instance) return fail("Exit checklist not found", undefined, 404)
    if (instance.kind !== "EXIT") return fail("That is an onboarding checklist", undefined, 400)
    if (instance.status !== "IN_PROGRESS") {
      return fail("This exit is already closed", undefined, 409)
    }
    if (instance.employeeId === session.user.id) {
      return fail("You cannot sign off your own exit", undefined, 403)
    }

    // ── THE GATE ────────────────────────────────────────────────────────────
    const gate = canComplete(instance.items as ChecklistItemState[])
    if (!gate.ok) {
      const names = gate.blocking.map((b) => b.text).join(", ")
      return fail(
        `Relieving cannot be issued yet. Waiting on ${gate.blocking.length} clearance${
          gate.blocking.length === 1 ? "" : "s"
        }: ${names}.`,
        { blocking: gate.blocking },
        409,
      )
    }

    const employee = instance.employee
    const now = new Date()

    const [, , seats, teamsRun] = await db.$transaction([
      db.checklistInstance.update({
        where: { id: instanceId },
        data: { status: "COMPLETED", completedAt: now, completedById: session.user.id },
      }),
      db.employee.update({
        where: { id: employee.id },
        data: { status: "RESIGNED", isActive: false },
      }),
      db.projectTeamMember.deleteMany({ where: { employeeId: employee.id } }),
      db.projectTeam.updateMany({ where: { managerId: employee.id }, data: { managerId: null } }),
    ])

    // Keeps the membership flag honest for anything reading it on its own.
    // Outside the transaction because it lives in the platform identity tables.
    try {
      await setMembershipActive({ employeeId: employee.id }, false)
    } catch (e) {
      console.error("[completeExitChecklist] membership deactivation failed", e)
    }

    await createNotification({
      employeeId: employee.id,
      title: "Exit clearance complete",
      message:
        "Your clearance is complete and your relieving has been processed. Your account access has now ended.",
      type: "info",
      link: "/profile",
    })

    // Relieving confirmation, best-effort - the sign-off itself has happened.
    try {
      if (employee.email) {
        const name = `${employee.firstName} ${employee.lastName}`.trim()
        addEmailJob({
          to: employee.email,
          cc: employee.manager?.email || undefined,
          subject: `Exit clearance complete - ${name}`,
          html: wrapEmail({
            title: "Exit clearance complete",
            bodyHtml: `
              <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#374151;">
                Dear ${employee.firstName}, all departmental clearances for your exit have been
                signed off and your relieving has been processed.
              </p>
              ${detailRow("Employee", `${name} (${employee.employeeNo})`)}
              ${detailRow("Department", employee.department?.name ?? "-")}
              ${detailRow("Last working day", toDateOnly(instance.anchorDate ?? now))}
              <p style="margin:16px 0 0; font-size:15px; line-height:1.7; color:#374151;">
                Thank you for everything you have contributed. We wish you all the very best.
              </p>`,
          }),
          text: "All departmental clearances for your exit have been signed off and your relieving has been processed.",
          profile: "notifications",
        })
      }
    } catch (e) {
      console.error("[completeExitChecklist] relieving email failed", e)
    }

    await createAuditLog(session, {
      action: "exit_checklist:complete",
      module: "exit",
      entityType: "ChecklistInstance",
      entityId: instanceId,
      changes: {
        employeeId: employee.id,
        deactivated: true,
        teamSeatsRemoved: seats.count,
        teamsLeftWithoutManager: teamsRun.count,
      },
      ...(await getAuditMeta()),
    })

    return ok(
      serialize({
        data: {
          id: instanceId,
          deactivated: true,
          teamSeatsRemoved: seats.count,
          teamsLeftWithoutManager: teamsRun.count,
        },
      }),
    )
  })
}

/**
 * Everyone currently serving notice.
 *
 * "Serving notice" is DERIVED, never stored: an accepted resignation, an account
 * still active. EmployeeStatus gains no SERVING_NOTICE value, so no existing
 * status filter anywhere in the app quietly changes meaning.
 *
 * Each row carries its exit checklist's progress and - the number HR actually
 * needs - which clearances are still blocking relieving.
 */
export async function listServingNotice(): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EXIT_READ)

    const rows = await db.resignation.findMany({
      where: { status: "APPROVED", employee: { isActive: true } },
      select: {
        id: true,
        createdAt: true,
        requestedLastWorkingDate: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNo: true,
            profilePhoto: true,
            lastWorkingDate: true,
            designation: { select: { title: true } },
            department: { select: { name: true } },
            manager: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { requestedLastWorkingDate: "asc" },
    })

    const employeeIds = rows.map((r) => r.employee.id)
    const checklists = employeeIds.length
      ? await db.checklistInstance.findMany({
          where: { kind: "EXIT", employeeId: { in: employeeIds } },
          select: {
            id: true,
            employeeId: true,
            status: true,
            items: {
              select: { id: true, text: true, itemKind: true, isRequired: true, isDone: true },
            },
          },
        })
      : []
    const byEmployee = new Map(checklists.map((c) => [c.employeeId, c]))

    const data = rows.map((r) => {
      const checklist = byEmployee.get(r.employee.id)
      const items = (checklist?.items ?? []) as ChecklistItemState[]
      return {
        resignationId: r.id,
        resignedOn: r.createdAt,
        lastWorkingDate: r.requestedLastWorkingDate ?? r.employee.lastWorkingDate,
        employee: r.employee,
        checklist: checklist
          ? {
              id: checklist.id,
              status: checklist.status,
              total: items.length,
              done: items.filter((i) => i.isDone).length,
              clearancesTotal: items.filter((i) => i.itemKind === "CLEARANCE").length,
              clearancesDone: items.filter((i) => i.itemKind === "CLEARANCE" && i.isDone).length,
              blocking: canComplete(items).blocking,
            }
          : null,
      }
    })

    return ok(serialize({ data }))
  })
}
