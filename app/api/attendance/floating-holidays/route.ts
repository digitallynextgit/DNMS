import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { notifyApprovers } from "@/lib/notifications"
import { sendFloatingHolidayRequestLetter } from "@/features/attendance/server/floating-holiday-mail"
import { SYSTEM_ROLES, FLOATING_HOLIDAY_LIMIT } from "@/lib/constants"
import type { Session } from "next-auth"

const HR_ROLES: string[] = [SYSTEM_ROLES.HR_MANAGER, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.ADMIN_]

export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const yearParam = new URL(req.url).searchParams.get("year")
      const year = yearParam ? Number(yearParam) : new Date().getUTCFullYear()

      const isHr = (session.user.roles ?? []).some((r) => HR_ROLES.includes(r))

      const [optionalHolidays, selections, reportsCount] = await Promise.all([
        db.holiday.findMany({
          where: {
            isOptional: true,
            date: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) },
          },
          orderBy: { date: "asc" },
        }),
        db.floatingHolidaySelection.findMany({
          where: { employeeId: session.user.id, year },
          select: {
            id: true,
            holidayId: true,
            status: true,
            reason: true,
            rejectionReason: true,
            managerApprovedAt: true,
            hrApprovedAt: true,
            createdAt: true,
          },
        }),
        isHr ? Promise.resolve(0) : db.employee.count({ where: { managerId: session.user.id } }),
      ])

      // Only approved holidays use the allowance; pending ones are still just requests.
      const used = selections.filter((s) => s.status === "APPROVED")

      return NextResponse.json({
        data: {
          year,
          limit: FLOATING_HOLIDAY_LIMIT,
          remaining: Math.max(0, FLOATING_HOLIDAY_LIMIT - used.length),
          optionalHolidays,
          selections,
          isApprover: isHr || reportsCount > 0,
        },
      })
    } catch (error) {
      console.error("[FLOATING_HOLIDAYS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// The mail is fire-and-forget, so a mailbox problem never fails the application.
async function notifyAndMail(
  applicantId: string,
  selectionId: string,
  holiday: { name: string; date: Date },
  reason: string | null,
  usedCount: number,
  year: number,
): Promise<void> {
  const applicant = await db.employee.findUnique({
    where: { id: applicantId },
    select: { firstName: true, lastName: true },
  })
  const applicantName = `${applicant?.firstName ?? ""} ${applicant?.lastName ?? ""}`.trim()

  await notifyApprovers({
    requesterId: applicantId,
    title: "Floating holiday request",
    message: `${applicantName} requested ${holiday.name} (${new Date(holiday.date).toDateString()}) as a floating holiday.`,
    link: "/calendar?view=holidays&tab=requests",
  })

  await sendFloatingHolidayRequestLetter({
    applicantId,
    selectionId,
    holidayName: holiday.name,
    holidayDate: new Date(holiday.date),
    reason,
    usedCount,
    limit: FLOATING_HOLIDAY_LIMIT,
    year,
  })
}

export const POST = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { holidayId, reason } = await req.json()
      if (!holidayId) {
        return NextResponse.json({ error: "holidayId is required" }, { status: 400 })
      }

      const holiday = await db.holiday.findUnique({ where: { id: holidayId } })
      if (!holiday) return NextResponse.json({ error: "Holiday not found" }, { status: 404 })
      if (!holiday.isOptional) {
        return NextResponse.json(
          { error: "Only optional (floating) holidays can be applied for" },
          { status: 422 },
        )
      }

      const todayUtc = new Date()
      todayUtc.setUTCHours(0, 0, 0, 0)
      if (new Date(holiday.date) < todayUtc) {
        return NextResponse.json(
          {
            error:
              "This floating holiday has already passed - you can only apply on or before its date.",
          },
          { status: 422 },
        )
      }

      const year = new Date(holiday.date).getUTCFullYear()

      const existing = await db.floatingHolidaySelection.findUnique({
        where: { employeeId_holidayId_year: { employeeId: session.user.id, holidayId, year } },
      })
      if (existing) {
        if (existing.status === "REJECTED" || existing.status === "CANCELLED") {
          // Re-apply on a previously rejected/cancelled request.
          const reopened = await db.floatingHolidaySelection.update({
            where: { id: existing.id },
            data: {
              status: "PENDING",
              reason: reason ? String(reason).trim() : null,
              managerApproverId: null,
              managerApprovedAt: null,
              hrApproverId: null,
              hrApprovedAt: null,
              rejectionReason: null,
              reviewedAt: null,
            },
          })
          const approvedCount = await db.floatingHolidaySelection.count({
            where: { employeeId: session.user.id, year, status: "APPROVED" },
          })
          await notifyAndMail(
            session.user.id,
            reopened.id,
            holiday,
            reopened.reason,
            approvedCount + 1,
            year,
          )
          return NextResponse.json({ data: reopened }, { status: 200 })
        }
        return NextResponse.json(
          { error: "You have already applied for this floating holiday." },
          { status: 422 },
        )
      }

      const approvedCount = await db.floatingHolidaySelection.count({
        where: { employeeId: session.user.id, year, status: "APPROVED" },
      })
      if (approvedCount >= FLOATING_HOLIDAY_LIMIT) {
        return NextResponse.json(
          {
            error: `You can avail only ${FLOATING_HOLIDAY_LIMIT} floating holidays for ${year}.`,
          },
          { status: 422 },
        )
      }

      const selection = await db.floatingHolidaySelection.create({
        data: {
          employeeId: session.user.id,
          holidayId,
          year,
          status: "PENDING",
          reason: reason ? String(reason).trim() : null,
        },
        include: { employee: { select: { firstName: true, lastName: true } } },
      })

      await notifyAndMail(
        session.user.id,
        selection.id,
        holiday,
        selection.reason,
        approvedCount + 1,
        year,
      )

      return NextResponse.json({ data: selection }, { status: 201 })
    } catch (error) {
      console.error("[FLOATING_HOLIDAYS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const DELETE = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const holidayId = new URL(req.url).searchParams.get("holidayId")
      if (!holidayId) {
        return NextResponse.json({ error: "holidayId is required" }, { status: 400 })
      }
      await db.floatingHolidaySelection.deleteMany({
        where: { employeeId: session.user.id, holidayId },
      })
      return NextResponse.json({ message: "Floating holiday request withdrawn" })
    } catch (error) {
      console.error("[FLOATING_HOLIDAYS_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
