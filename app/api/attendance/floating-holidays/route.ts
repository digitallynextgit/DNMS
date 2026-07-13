import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { notifyApprovers } from "@/lib/notifications"
import { SYSTEM_ROLES, HIDDEN_ROLES } from "@/lib/constants"
import type { Session } from "next-auth"

// Each employee may avail this many floating (optional) holidays per year.
export const FLOATING_HOLIDAY_LIMIT = 3

// Statuses that count against an employee's yearly allowance.
const ACTIVE = ["PENDING", "APPROVED"] as const

// Who can review floating-holiday requests: HR, or anyone who manages someone.
const HR_ROLES: string[] = [SYSTEM_ROLES.HR_MANAGER, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.ADMIN_]

/**
 * GET /api/attendance/floating-holidays?year=2026
 * The optional holidays for the year + the current employee's requests (with status).
 */
export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const yearParam = new URL(req.url).searchParams.get("year")
      const year = yearParam ? Number(yearParam) : new Date().getUTCFullYear()

      const isHr = (session.user.roles ?? []).some((r) => HR_ROLES.includes(r))

      const [optionalHolidays, selections, reportsCount, birthdayEmployees] = await Promise.all([
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
        // Does this person manage anyone? (drives the approver inbox tab)
        isHr ? Promise.resolve(0) : db.employee.count({ where: { managerId: session.user.id } }),
        // Everyone's birthday (a paid day off for each person) - shown on the
        // calendar as a team birthday view. Excludes the hidden watch account.
        db.employee.findMany({
          where: {
            isActive: true,
            status: { in: ["ACTIVE", "ON_LEAVE"] },
            dateOfBirth: { not: null },
            NOT: { employeeRoles: { some: { role: { name: { in: [...HIDDEN_ROLES] } } } } },
          },
          select: { firstName: true, lastName: true, dateOfBirth: true },
        }),
      ])

      const used = selections.filter((s) => ACTIVE.includes(s.status as "PENDING" | "APPROVED"))

      const pad2 = (n: number) => String(n).padStart(2, "0")
      const birthdays = birthdayEmployees
        .filter((e) => e.dateOfBirth)
        .map((e) => ({
          date: `${year}-${pad2(e.dateOfBirth!.getUTCMonth() + 1)}-${pad2(e.dateOfBirth!.getUTCDate())}`,
          name: `${e.firstName} ${e.lastName ?? ""}`.trim(),
        }))

      return NextResponse.json({
        data: {
          year,
          limit: FLOATING_HOLIDAY_LIMIT,
          remaining: Math.max(0, FLOATING_HOLIDAY_LIMIT - used.length),
          optionalHolidays,
          selections,
          birthdays,
          // True for HR or anyone who manages at least one employee.
          isApprover: isHr || reportsCount > 0,
        },
      })
    } catch (error) {
      console.error("[FLOATING_HOLIDAYS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

/**
 * POST /api/attendance/floating-holidays   body: { holidayId, reason? }
 * Applies for a floating holiday. Creates a PENDING request and notifies the
 * employee's manager + HR. It only counts once HR approves.
 */
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

      // Can't apply for a floating holiday whose date has already passed.
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
          // Let them re-apply on a previously rejected/cancelled one.
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
          return NextResponse.json({ data: reopened }, { status: 200 })
        }
        return NextResponse.json(
          { error: "You have already applied for this floating holiday." },
          { status: 422 },
        )
      }

      const activeCount = await db.floatingHolidaySelection.count({
        where: { employeeId: session.user.id, year, status: { in: [...ACTIVE] } },
      })
      if (activeCount >= FLOATING_HOLIDAY_LIMIT) {
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

      await notifyApprovers({
        requesterId: session.user.id,
        title: "Floating holiday request",
        message: `${selection.employee.firstName} ${selection.employee.lastName} requested ${holiday.name} (${new Date(holiday.date).toDateString()}) as a floating holiday.`,
        link: "/holiday-calendar?tab=requests",
      })

      return NextResponse.json({ data: selection }, { status: 201 })
    } catch (error) {
      console.error("[FLOATING_HOLIDAYS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

/**
 * DELETE /api/attendance/floating-holidays?holidayId=...
 * Withdraws the current employee's own floating-holiday request.
 */
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
