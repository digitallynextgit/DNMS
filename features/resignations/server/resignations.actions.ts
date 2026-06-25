"use server"

import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createNotification, notifyApprovers } from "@/lib/notifications"
import { createAuditLog } from "@/lib/audit"
import { sendEmail, sendEmailAs } from "@/lib/mailer"
import { requireSession, getAuditMeta } from "@/server/action-guard"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import { startOfDayUTC, toDateOnly } from "@/lib/dates"
import { renderDecisionEmail, renderResignationRequestEmail } from "@/lib/email-layout"

// Roles whose holders act as HR for approvals/notifications.
const HR_ROLE_NAMES = ["hr_manager", "admin"]

// An employee may only have one resignation in flight at a time.
const OPEN_STATUSES = ["PENDING"] as const

// ---------------------------------------------------------------------------
// getMyResignation – the current user's latest resignation (any status), used
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
// applyResignation – employee submits a resignation. Stays PENDING until the
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
        manager: { select: { firstName: true, lastName: true, email: true } },
      },
    })
    if (!me) return fail("Employee not found")
    if (!me.isActive) return fail("Your account is not active")
    if (me.status === "RESIGNED" || me.status === "TERMINATED")
      return fail("You have already resigned")

    const existing = await db.resignation.findFirst({
      where: { employeeId: me.id, status: { in: [...OPEN_STATUSES] } },
    })
    if (existing) return fail("You already have a resignation request pending approval")

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
        const hrMailbox = process.env.HR_EMAIL?.trim()
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
            reason: input.reason?.trim() || null,
            lastWorkingDate: lastWorkingDate ? toDateOnly(lastWorkingDate) : null,
            managerName: me.manager
              ? `${me.manager.firstName} ${me.manager.lastName}`.trim()
              : null,
            reviewUrl: process.env.NEXTAUTH_URL
              ? `${process.env.NEXTAUTH_URL.replace(/\/$/, "")}/resignations`
              : undefined,
          })
          await sendEmailAs(me.id, {
            to,
            cc,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
          })
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
// cancelResignation – employee withdraws their own pending resignation.
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
// getResignationsToReview – resignations the current user may act on:
//   • HR / admin (employee:write) see every pending resignation
//   • a manager sees pending resignations from their direct reports
// Paginated (skip/take/count); defaults to page 1, limit 10.
// ---------------------------------------------------------------------------
export async function getResignationsToReview(
  filters: { page?: number; limit?: number } = {},
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const canReviewAll = hasPermission(session, PERMISSIONS.EMPLOYEE_WRITE)

    const { page, limit, skip, take } = resolvePagination(filters, 10)

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
        pagination: paginationMeta(total, page, limit),
      }),
    )
  })
}

// ---------------------------------------------------------------------------
// reviewResignation – the direct manager (or HR) approves or rejects.
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
          select: { id: true, firstName: true, email: true, managerId: true, status: true },
        },
      },
    })
    if (!resignation) return fail("Resignation not found")
    if (resignation.status !== "PENDING")
      return fail(`This resignation is already ${resignation.status.toLowerCase()}`)
    if (resignation.employeeId === session.user.id)
      return fail("You cannot review your own resignation")

    const isManager = resignation.employee.managerId === session.user.id
    const canReviewAll = hasPermission(session, PERMISSIONS.EMPLOYEE_WRITE)
    if (!isManager && !canReviewAll)
      return fail("Only the employee's manager or HR can review this resignation")

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

    // APPROVE: accept the resignation AND deactivate the employee in one transaction.
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
        data: {
          status: "RESIGNED",
          isActive: false,
          resignationDate: new Date(),
          lastWorkingDate,
        },
      }),
    ])

    await createNotification({
      employeeId: resignation.employeeId,
      title: "Resignation approved",
      message:
        "Your resignation has been approved. Your account has been deactivated and you will be signed out.",
      type: "info",
      link: "/profile",
    })

    // Best-effort email; never block the approval on a mail failure.
    try {
      if (resignation.employee.email) {
        const email = renderDecisionEmail({
          kind: "Resignation request",
          approved: true,
          firstName: resignation.employee.firstName,
          detailLine: "Your DNMS account has been deactivated effective immediately.",
        })
        await sendEmail({
          to: resignation.employee.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        })
      }
    } catch {
      // non-blocking
    }

    const meta = await getAuditMeta()
    await createAuditLog(session, {
      action: "RESIGNATION_APPROVE",
      module: "employee",
      entityType: "Resignation",
      entityId: id,
      changes: { employeeId: resignation.employeeId, deactivated: true },
      ...meta,
    })

    return ok(serialize({ data: updated }))
  })
}
