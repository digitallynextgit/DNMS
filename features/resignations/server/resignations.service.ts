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

const HR_ROLE_NAMES = ["hr_manager", "admin"]

// APPROVED blocks too: an accepted leaver stays signed in during the notice period.
const BLOCKING_STATUSES = ["PENDING", "APPROVED"] as const

// Latest resignation (any status); drives the profile button (Apply / Pending / Resigned).
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
        // Set only when the employee has a Gmail App Password; gates the HR email below.
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

    await notifyApprovers({
      requesterId: me.id,
      title: "Resignation submitted",
      message: `${me.firstName} ${me.lastName} has submitted a resignation that needs your approval.`,
      link: "/resignations",
    })

    // Best-effort email to HR (manager on CC) from the employee's own Gmail.
    try {
      if (me.gmailAppPassword) {
        const managerEmail = me.manager?.email || undefined

        // Shared HR inbox first; else HR-role employees, then the manager.
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
          // Saved so the decision email replies on the same thread.
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

// HR/admin see every pending resignation; a manager sees their direct reports'.
export async function getResignationsToReview(
  filters: { page?: number; limit?: number } = {},
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const canReviewAll = hasPermission(session, PERMISSIONS.RESIGNATION_APPROVE)

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

// For the live sidebar badge.
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

    // APPROVE starts the notice period and the account stays active. It is deactivated at HR's
    // exit sign-off (completeExitChecklist) or by the exit-deactivation cron as a backstop.
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

    // Best-effort: a tenant with no exit template must not lose the decision; HR can start one by hand.
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
        deactivated: false,
        lastWorkingDate: toDateOnly(lastWorkingDate),
      },
      ...meta,
    })

    return ok(serialize({ data: updated }))
  })
}
