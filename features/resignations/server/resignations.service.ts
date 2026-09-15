import "server-only"

import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createNotification, notifyApprovers } from "@/lib/notifications"
import { instantiateAndNotify } from "@/features/hr-checklists/server/checklists.service"
import { createAuditLog } from "@/lib/audit"
import { sendEmailAs } from "@/lib/mailer"
import { addEmailJob } from "@/lib/queue"
import { requireSession, getAuditMeta } from "@/server/action-guard"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import { startOfDayUTC, toDateOnly } from "@/lib/dates"
import { renderResignationDecisionEmail, renderResignationRequestEmail } from "@/lib/email-layout"
import { getConfig, warmConfig } from "@/server/app-config"

// Roles whose holders act as HR for approvals/notifications.
const HR_ROLE_NAMES = ["hr_manager", "admin"]

// An employee may only have one resignation in flight at a time.
/**
 * Statuses that stop somebody resigning again.
 *
 * Includes APPROVED, which it did not need to before: approval used to close
 * the account in the same transaction, so an accepted leaver could not reach
 * the form at all. Now approval starts a NOTICE PERIOD and they stay signed in
 * until their exit is signed off - so without this they could resign twice.
 *
 * Deliberately NOT reused for the review queue, which filters on PENDING
 * directly: an accepted resignation must not reappear in a reviewer's inbox.
 */
const BLOCKING_STATUSES = ["PENDING", "APPROVED"] as const

// ---------------------------------------------------------------------------
// getMyResignation - the current user's latest resignation (any status), used
// to drive the profile button state (Apply / Pending / Resigned).
// ---------------------------------------------------------------------------
export async function getMyResignation(): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const resignation = await db.resignation.findFirst({
      where: { employeeId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true } },
      },
    })
    return ok(serialize({ data: resignation }))
  })
}

// ---------------------------------------------------------------------------
// applyResignation - employee submits a resignation. Stays PENDING until the
// manager (or HR) acts. Notifies the manager + HR approvers.
// ---------------------------------------------------------------------------
export async function applyResignation(input: {
  reason?: string
  requestedLastWorkingDate?: string
}): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()

    const me = await db.employee.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNo: true,
        status: true,
        isActive: true,
        // Present only when the employee has configured a Gmail App Password -
        // i.e. their personal Google SMTP. We gate the HR email on this.
        gmailAppPassword: true,
        department: { select: { name: true } },
        designation: { select: { title: true } },
        manager: { select: { firstName: true, lastName: true, email: true } },
      },
    })
    if (!me) return fail("Employee not found")
    if (!me.isActive) return fail("Your account is not active")
    if (me.status === "RESIGNED" || me.status === "TERMINATED")
      return fail("You have already resigned")

    const existing = await db.resignation.findFirst({
      where: { employeeId: me.id, status: { in: [...BLOCKING_STATUSES] } },
      select: { status: true },
    })
    if (existing) {
      return fail(
        existing.status === "APPROVED"
          ? "Your resignation has already been accepted and you are serving your notice period"
          : "You already have a resignation request pending approval",
      )
    }

    let lastWorkingDate: Date | null = null
    if (input.requestedLastWorkingDate) {
      const d = startOfDayUTC(input.requestedLastWorkingDate)
      if (isNaN(d.getTime())) return fail("Invalid last working date")
      lastWorkingDate = d
    }

    const resignation = await db.resignation.create({
      data: {
        employeeId: me.id,
        reason: input.reason?.trim() || null,
        requestedLastWorkingDate: lastWorkingDate,
        status: "PENDING",
      },
    })

    // Notify the direct manager + HR approvers that there's a resignation to review.
    await notifyApprovers({
      requesterId: me.id,
      title: "Resignation submitted",
      message: `${me.firstName} ${me.lastName} has submitted a resignation that needs your approval.`,
      link: "/resignations",
    })

    // Email HR (with the reporting manager in CC) FROM the employee's own Gmail,
    // carrying the reason - but only when the employee has configured a Google
    // App Password (their personal SMTP). Best-effort; never blocks the apply.
    try {
      if (me.gmailAppPassword) {
        const managerEmail = me.manager?.email || undefined

        // Send to the shared HR inbox (HR_EMAIL). Only if it isn't configured do
        // we fall back to the work emails of HR-role employees, then the manager.
        let to: string[] = []
        const hrMailbox = (await getConfig("HR_EMAIL"))?.trim()
        if (hrMailbox) {
          to = [hrMailbox]
        } else {
          const hr = await db.employee.findMany({
            where: {
              isActive: true,
              id: { not: me.id },
              employeeRoles: { some: { role: { name: { in: HR_ROLE_NAMES } } } },
            },
            select: { email: true },
          })
          to = [...new Set(hr.map((h) => h.email).filter(Boolean))]
        }
        if (to.length === 0 && managerEmail) to = [managerEmail]

        // CC the reporting manager (unless they're already the sole recipient).
        const cc = managerEmail && !to.includes(managerEmail) ? managerEmail : undefined

        if (to.length > 0) {
          const mail = renderResignationRequestEmail({
            employeeName: `${me.firstName} ${me.lastName}`.trim(),
            employeeNo: me.employeeNo,
            department: me.department?.name ?? null,
            designation: me.designation?.title ?? null,
            reason: input.reason?.trim() || null,
            lastWorkingDate: lastWorkingDate ? toDateOnly(lastWorkingDate) : null,
            reviewUrl: process.env.NEXTAUTH_URL
              ? `${process.env.NEXTAUTH_URL.replace(/\/$/, "")}/resignations`
              : undefined,
          })
          const messageId = await sendEmailAs(me.id, {
            to,
            cc,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
          })
          // Store the sent email's Message-ID so the approve/decline email can
          // reply on the same thread.
          if (messageId) {
            await db.resignation.update({
              where: { id: resignation.id },
              data: { requestEmailMessageId: messageId },
            })
          }
        }
      }
    } catch (err) {
      console.error("[applyResignation] HR notification email failed:", err)
    }

    const meta = await getAuditMeta()
    await createAuditLog(session, {
      action: "RESIGNATION_APPLY",
      module: "employee",
      entityType: "Resignation",
      entityId: resignation.id,
      changes: {
        reason: input.reason ?? null,
        requestedLastWorkingDate: input.requestedLastWorkingDate ?? null,
      },
      ...meta,
    })

    return ok(serialize({ data: resignation }))
  })
}

// ---------------------------------------------------------------------------
// cancelResignation - employee withdraws their own pending resignation.
// ---------------------------------------------------------------------------
export async function cancelResignation(id: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const resignation = await db.resignation.findUnique({ where: { id } })
    if (!resignation) return fail("Resignation not found")
    if (resignation.employeeId !== session.user.id)
      return fail("You can only withdraw your own resignation")
    if (resignation.status !== "PENDING")
      return fail(
        `Cannot withdraw a resignation that is already ${resignation.status.toLowerCase()}`,
      )

    const updated = await db.resignation.update({
      where: { id },
      data: { status: "CANCELLED" },
    })
    return ok(serialize({ data: updated }))
  })
}

// ---------------------------------------------------------------------------
// getResignationsToReview - resignations the current user may act on:
//   • HR / admin (employee:write) see every pending resignation
//   • a manager sees pending resignations from their direct reports
// Paginated (skip/take/count); defaults to page 1, limit 10.
// ---------------------------------------------------------------------------
export async function getResignationsToReview(
  filters: { page?: number; limit?: number } = {},
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const canReviewAll = hasPermission(session, PERMISSIONS.RESIGNATION_APPROVE)

    // Only HR/admin (canReviewAll) or a manager with at least one direct report
    // may access this page. Regular employees are not authorized; the client
    // redirects them away.
    const authorized =
      canReviewAll || (await db.employee.count({ where: { managerId: session.user.id } })) > 0

    const { page, limit, skip, take } = resolvePagination(filters, 10)

    if (!authorized) {
      return ok(
        serialize({
          data: [],
          canReviewAll: false,
          authorized: false,
          pagination: paginationMeta(0, page, limit),
        }),
      )
    }

    const where = canReviewAll
      ? { status: "PENDING" as const }
      : { status: "PENDING" as const, employee: { managerId: session.user.id } }

    const [resignations, total] = await Promise.all([
      db.resignation.findMany({
        where,
        include: {
          employee: {
            select: {
              ...EMPLOYEE_SUMMARY_SELECT,
              email: true,
              department: { select: { name: true } },
              designation: { select: { title: true } },
              manager: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      db.resignation.count({ where }),
    ])

    return ok(
      serialize({
        data: resignations,
        canReviewAll,
        authorized: true,
        pagination: paginationMeta(total, page, limit),
      }),
    )
  })
}

// ---------------------------------------------------------------------------
// getPendingResignationCount - number of PENDING resignations the current user
// may review (HR/admin: all; a manager: their direct reports; others: 0). Used
// for the live sidebar badge.
// ---------------------------------------------------------------------------
export async function getPendingResignationCount(): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const session = await requireSession()
    const canReviewAll = hasPermission(session, PERMISSIONS.RESIGNATION_APPROVE)
    const where = canReviewAll
      ? { status: "PENDING" as const }
      : { status: "PENDING" as const, employee: { managerId: session.user.id } }
    const count = await db.resignation.count({ where })
    return ok({ count })
  })
}

// ---------------------------------------------------------------------------
// reviewResignation - the direct manager (or HR) approves or rejects.
// On APPROVE the employee is marked RESIGNED and deactivated immediately, which
// blocks any further login (authorize() rejects inactive accounts).
// ---------------------------------------------------------------------------
export async function reviewResignation(
  id: string,
  action: "APPROVE" | "REJECT",
  note?: string,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    if (action !== "APPROVE" && action !== "REJECT") return fail("Action must be APPROVE or REJECT")

    const resignation = await db.resignation.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            managerId: true,
            status: true,
            manager: { select: { email: true } },
          },
        },
      },
    })
    if (!resignation) return fail("Resignation not found")
    if (resignation.status !== "PENDING")
      return fail(`This resignation is already ${resignation.status.toLowerCase()}`)
    if (resignation.employeeId === session.user.id)
      return fail("You cannot review your own resignation")

    const isManager = resignation.employee.managerId === session.user.id
    const canReviewAll = hasPermission(session, PERMISSIONS.RESIGNATION_APPROVE)
    if (!isManager && !canReviewAll)
      return fail("Only the employee's manager or HR can review this resignation")

    // Warm runtime config so the email logo/branding reflect admin settings.
    await warmConfig()

    if (action === "REJECT") {
      const updated = await db.resignation.update({
        where: { id },
        data: {
          status: "REJECTED",
          reviewerId: session.user.id,
          reviewedAt: new Date(),
          reviewNote: note?.trim() || null,
        },
      })

      await createNotification({
        employeeId: resignation.employeeId,
        title: "Resignation declined",
        message: `Your resignation was declined.${note?.trim() ? ` Note: ${note.trim()}` : ""}`,
        type: "warning",
        link: "/profile",
      })

      // Best-effort decline letter to the employee (manager CC'd), from HR.
      try {
        if (resignation.employee.email) {
          const email = renderResignationDecisionEmail({
            approved: false,
            employeeName:
              `${resignation.employee.firstName} ${resignation.employee.lastName}`.trim(),
            firstName: resignation.employee.firstName,
            note: note?.trim() || null,
          })
          addEmailJob({
            to: resignation.employee.email,
            cc: resignation.employee.manager?.email || undefined,
            subject: email.subject,
            html: email.html,
            text: email.text,
            inReplyTo: resignation.requestEmailMessageId ?? undefined,
            references: resignation.requestEmailMessageId ?? undefined,
          })
        }
      } catch (e) {
        console.error("[reviewResignation] decline email failed:", e)
      }

      const meta = await getAuditMeta()
      await createAuditLog(session, {
        action: "RESIGNATION_REJECT",
        module: "employee",
        entityType: "Resignation",
        entityId: id,
        changes: { note: note ?? null },
        ...meta,
      })

      return ok(serialize({ data: updated }))
    }

    // ── APPROVE = "accepted, now serving notice" ────────────────────────────
    //
    // This used to set isActive:false in the same breath, which locked the
    // employee out the instant their manager clicked Approve. That made the
    // whole exit process impossible: the handover document, the transfer of
    // client communications and of Drive ownership are all THEIR work, done
    // during the notice period, and none of it can happen from a dead account.
    //
    // The dates are recorded and the account stays ACTIVE. Deactivation moves to
    // HR's final sign-off on the exit checklist (completeExitChecklist), which
    // refuses until every required department clearance is signed - and, as a
    // backstop for a checklist nobody finishes, to the exit-deactivation cron on
    // the day after the last working day.
    //
    // EmployeeStatus deliberately gains no SERVING_NOTICE value: "serving
    // notice" is derived from an accepted resignation plus an active account, so
    // no existing status filter in the app changes meaning.
    const lastWorkingDate = resignation.requestedLastWorkingDate ?? new Date()
    const [updated] = await db.$transaction([
      db.resignation.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewerId: session.user.id,
          reviewedAt: new Date(),
          reviewNote: note?.trim() || null,
        },
      }),
      db.employee.update({
        where: { id: resignation.employeeId },
        data: { resignationDate: new Date(), lastWorkingDate },
      }),
    ])

    // Start the exit clearance from the tenant's template, dated back from the
    // last working day. Best-effort: a tenant with no template yet must not lose
    // the resignation decision itself, and HR can start one by hand.
    try {
      await instantiateAndNotify({
        employeeId: resignation.employeeId,
        kind: "EXIT",
        resignationId: id,
        anchorDate: lastWorkingDate,
        actorId: session.user.id,
      })
    } catch (e) {
      console.error("[reviewResignation] exit checklist failed", e)
    }

    await createNotification({
      employeeId: resignation.employeeId,
      title: "Resignation approved",
      message:
        "Your resignation has been accepted. You are now serving your notice period - your exit clearance has been started and you keep full access until your last working day.",
      type: "info",
      link: "/profile",
    })

    // Best-effort acceptance letter to the employee (manager CC'd), from HR.
    try {
      if (resignation.employee.email) {
        const email = renderResignationDecisionEmail({
          approved: true,
          employeeName: `${resignation.employee.firstName} ${resignation.employee.lastName}`.trim(),
          firstName: resignation.employee.firstName,
          lastWorkingDate: toDateOnly(lastWorkingDate),
          note: note?.trim() || null,
        })
        addEmailJob({
          to: resignation.employee.email,
          cc: resignation.employee.manager?.email || undefined,
          subject: email.subject,
          html: email.html,
          text: email.text,
          inReplyTo: resignation.requestEmailMessageId ?? undefined,
          references: resignation.requestEmailMessageId ?? undefined,
        })
      }
    } catch (e) {
      console.error("[reviewResignation] approval email failed:", e)
    }

    const meta = await getAuditMeta()
    await createAuditLog(session, {
      action: "RESIGNATION_APPROVE",
      module: "employee",
      entityType: "Resignation",
      entityId: id,
      changes: {
        employeeId: resignation.employeeId,
        // NOT deactivated any more - the notice period starts here and the
        // account closes at the exit sign-off.
        deactivated: false,
        lastWorkingDate: toDateOnly(lastWorkingDate),
      },
      ...meta,
    })

    return ok(serialize({ data: updated }))
  })
}
