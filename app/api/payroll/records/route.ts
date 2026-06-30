import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import type { Session } from "next-auth"

export const GET = withAuth(
  PERMISSIONS.PAYROLL_READ,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { searchParams } = new URL(req.url)
      const month = searchParams.get("month") ? Number(searchParams.get("month")) : undefined
      const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined
      const status = searchParams.get("status") ?? undefined
      const employeeId = searchParams.get("employeeId") ?? undefined
      const search = searchParams.get("search")?.trim() || undefined

      // Pagination is opt-in: the HR records table passes ?page; other consumers
      // (e.g. an employee's full payslip history) omit it and get every record.
      const pageParam = searchParams.get("page")
      const paginate = pageParam !== null
      const { page, limit, skip } = resolvePagination(
        { page: pageParam, limit: searchParams.get("limit") },
        10,
      )

      const where: Record<string, unknown> = {}
      if (month) where.month = month
      if (year) where.year = year
      if (status) where.status = status
      // HR (payroll:write) sees everyone; employees only their own payslips.
      if (hasPermission(session, PERMISSIONS.PAYROLL_WRITE)) {
        if (employeeId) where.employeeId = employeeId
      } else {
        where.employeeId = session.user.id
      }
      // Employee name / number search (server-side).
      if (search) {
        where.employee = {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { employeeNo: { contains: search, mode: "insensitive" } },
          ],
        }
      }

      const include = {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNo: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, title: true } },
          },
        },
      } as const
      const orderBy = [
        { year: "desc" as const },
        { month: "desc" as const },
        { createdAt: "desc" as const },
      ]

      const [records, total] = await Promise.all([
        db.payrollRecord.findMany({
          where,
          include,
          orderBy,
          ...(paginate ? { skip, take: limit } : {}),
        }),
        db.payrollRecord.count({ where }),
      ])

      return NextResponse.json({
        data: records,
        pagination: paginate
          ? paginationMeta(total, page, limit)
          : { total, page: 1, limit: total, totalPages: 1 },
      })
    } catch (error) {
      console.error("[PAYROLL_RECORDS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const POST = withAuth(
  PERMISSIONS.PAYROLL_PROCESS,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const body = await req.json()
      const { month, year, employeeIds } = body

      if (!month || !year) {
        return NextResponse.json({ error: "month and year are required" }, { status: 400 })
      }

      const monthNum = Number(month)
      const yearNum = Number(year)

      if (monthNum < 1 || monthNum > 12) {
        return NextResponse.json({ error: "month must be between 1 and 12" }, { status: 400 })
      }

      // Fetch employees to process
      const employeeWhere: Record<string, unknown> = {
        isActive: true,
        status: "ACTIVE",
        salaryStructure: { isNot: null },
      }

      if (Array.isArray(employeeIds) && employeeIds.length > 0) {
        employeeWhere.id = { in: employeeIds }
      }

      const employees = await db.employee.findMany({
        where: employeeWhere,
        include: {
          salaryStructure: true,
        },
      })

      if (employees.length === 0) {
        return NextResponse.json(
          { error: "No active employees with a salary structure found" },
          { status: 400 },
        )
      }

      // Pay model: daily rate = monthly salary ÷ 30 (fixed divisor). An employee
      // earns one day's pay for every calendar day they're credited - weekends and
      // company holidays are paid, and each WORKING day is paid only when they were
      // present (or on approved PAID leave). A working day with no punch and no paid
      // leave is an unpaid absence and docks salary/30. Days before joining aren't
      // paid; future days of an in-progress month are assumed present.
      // So a fully-present 31-day month pays salary×31/30, a 28-day month ×28/30,
      // and three absences dock salary×3/30.
      const daysInMonth = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate()
      const STANDARD_MONTH_DAYS = 30

      // UTC month boundaries (attendance/holiday/leave dates are stored at UTC midnight).
      const monthStart = new Date(Date.UTC(yearNum, monthNum - 1, 1))
      const monthEnd = new Date(Date.UTC(yearNum, monthNum - 1, daysInMonth, 23, 59, 59, 999))
      const ymd = (d: Date) => d.toISOString().slice(0, 10)
      const monthEndYmd = ymd(monthEnd)
      const todayYmd = new Date().toISOString().slice(0, 10)

      // Company holidays (office closed → paid days off). Optional/floating holidays
      // stay normal working days.
      const monthHolidays = await db.holiday.findMany({
        where: { date: { gte: monthStart, lte: monthEnd }, isOptional: false },
        select: { date: true },
      })
      const holidaySet = new Set(monthHolidays.map((h) => ymd(h.date)))
      const isOffDay = (date: Date) => {
        const dow = date.getUTCDay()
        return dow === 0 || dow === 6 || holidaySet.has(ymd(date))
      }

      const created: string[] = []
      const skipped: string[] = []
      const notEmployed: string[] = []
      const errors: string[] = []

      for (const employee of employees) {
        try {
          // Skip if record already exists
          const existing = await db.payrollRecord.findUnique({
            where: {
              employeeId_month_year: {
                employeeId: employee.id,
                month: monthNum,
                year: yearNum,
              },
            },
          })

          if (existing) {
            skipped.push(employee.id)
            continue
          }

          const ss = employee.salaryStructure!

          // Not employed for any day of this month yet → no payslip.
          const joiningYmd = employee.dateOfJoining ? ymd(employee.dateOfJoining) : null
          if (joiningYmd && joiningYmd > monthEndYmd) {
            notEmployed.push(employee.id)
            continue
          }

          // Attendance punches keyed by day.
          const attendanceLogs = await db.attendanceLog.findMany({
            where: { employeeId: employee.id, date: { gte: monthStart, lte: monthEnd } },
            select: { date: true, status: true },
          })
          const attByDay = new Map<string, string>()
          for (const log of attendanceLogs) attByDay.set(ymd(log.date), log.status)

          // Approved leaves → per-working-day paid / unpaid sets.
          const approvedLeaves = await db.leaveRequest.findMany({
            where: {
              employeeId: employee.id,
              status: "APPROVED",
              startDate: { lte: monthEnd },
              endDate: { gte: monthStart },
            },
            include: { leaveType: { select: { isPaid: true } } },
          })
          const paidLeave = new Set<string>()
          const unpaidLeave = new Set<string>()
          for (const leave of approvedLeaves) {
            const start = leave.startDate > monthStart ? leave.startDate : monthStart
            const end = leave.endDate < monthEnd ? leave.endDate : monthEnd
            const cur = new Date(
              Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
            )
            const endDay = new Date(
              Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
            )
            while (cur <= endDay) {
              if (!isOffDay(cur)) (leave.leaveType.isPaid ? paidLeave : unpaidLeave).add(ymd(cur))
              cur.setUTCDate(cur.getUTCDate() + 1)
            }
          }

          // Approved floating holidays → paid days off for this employee.
          const floatingOff = new Set<string>()
          const floating = await db.floatingHolidaySelection.findMany({
            where: {
              employeeId: employee.id,
              status: "APPROVED",
              holiday: { date: { gte: monthStart, lte: monthEnd } },
            },
            select: { holiday: { select: { date: true } } },
          })
          for (const f of floating) floatingOff.add(ymd(f.holiday.date))

          // ── Walk every calendar day and credit pay from attendance ──────────
          // Off days (weekend/holiday) are paid. Working days are paid only when
          // the employee was present / on paid leave; an absence (no punch, no paid
          // leave) or unpaid leave docks salary/30. Half-days pay 0.5.
          let payableDays = 0 // days credited (drives the proration ratio)
          let lopDays = 0 // unpaid days, for the record
          let leaveDaysInMonth = 0 // paid-leave days, for the record
          for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(Date.UTC(yearNum, monthNum - 1, d))
            const key = ymd(date)
            if (joiningYmd && key < joiningYmd) continue // before joining → unpaid, not employed
            if (isOffDay(date) || floatingOff.has(key)) {
              payableDays += 1 // weekend / holiday / approved floating holiday → paid
              continue
            }
            if (key > todayYmd) {
              payableDays += 1 // future working day of an in-progress month → assumed present
              continue
            }
            const att = attByDay.get(key)
            if (att === "PRESENT" || att === "LATE") {
              payableDays += 1
            } else if (att === "HALF_DAY") {
              payableDays += 0.5
              lopDays += 0.5
            } else if (att === "ABSENT") {
              lopDays += 1
            } else if (paidLeave.has(key)) {
              payableDays += 1
              leaveDaysInMonth += 1
            } else {
              // No punch and no paid leave (incl. unpaid leave) → unpaid absence.
              lopDays += 1
            }
          }
          payableDays = Math.round(payableDays * 100) / 100
          lopDays = Math.round(lopDays * 100) / 100

          // Daily rate = salary ÷ 30; pay = rate × credited days.
          const ratio = payableDays / STANDARD_MONTH_DAYS

          // Scale earnings proportionally
          const basicSalary = Math.round(ss.basicSalary * ratio * 100) / 100
          const hra = Math.round(ss.hra * ratio * 100) / 100
          const conveyance = Math.round(ss.conveyance * ratio * 100) / 100
          const medicalAllowance = Math.round(ss.medicalAllowance * ratio * 100) / 100
          const telephoneAllowance = Math.round(ss.telephoneAllowance * ratio * 100) / 100
          const otherAllowances = Math.round(ss.otherAllowances * ratio * 100) / 100
          const overtime = 0

          const grossSalary =
            basicSalary +
            hra +
            conveyance +
            medicalAllowance +
            telephoneAllowance +
            otherAllowances +
            overtime

          // Company has < 20 employees → no statutory deductions; salary is fully
          // in-hand. Net = Gross (LWP/absences already reduced gross via proration).
          const pfEmployee = 0
          const pfEmployer = 0
          const esi = 0
          const tds = 0
          const otherDeductions = 0

          const totalDeductions = pfEmployee + esi + tds + otherDeductions
          const netSalary = Math.max(0, grossSalary - totalDeductions)

          const record = await db.payrollRecord.create({
            data: {
              employeeId: employee.id,
              salaryStructureId: ss.id,
              month: monthNum,
              year: yearNum,
              workingDays: daysInMonth,
              presentDays: payableDays,
              leaveDays: leaveDaysInMonth,
              lopDays,
              basicSalary,
              hra,
              conveyance,
              medicalAllowance,
              telephoneAllowance,
              otherAllowances,
              overtime,
              grossSalary,
              pfEmployee,
              pfEmployer,
              esi,
              tds,
              otherDeductions,
              totalDeductions,
              netSalary,
              status: "DRAFT",
            },
          })

          created.push(record.id)

          // In-app notification: payslip ready
          const monthName = new Date(yearNum, monthNum - 1).toLocaleString("default", {
            month: "long",
          })
          await createNotification({
            employeeId: employee.id,
            title: "Payslip Ready",
            message: `Your payslip for ${monthName} ${yearNum} is ready. Net pay: ₹${netSalary.toLocaleString("en-IN")}.`,
            type: "success",
            link: "/payroll/me",
          })
        } catch (empError) {
          console.error(`[PAYROLL_GENERATE] Error for employee ${employee.id}:`, empError)
          errors.push(employee.id)
        }
      }

      const notEmployedNote = notEmployed.length ? `, ${notEmployed.length} not yet joined` : ""
      return NextResponse.json(
        {
          message: `Payroll generated: ${created.length} created, ${skipped.length} skipped (already exist)${notEmployedNote}, ${errors.length} errors`,
          created: created.length,
          skipped: skipped.length,
          notEmployed: notEmployed.length,
          errors: errors.length,
        },
        { status: 201 },
      )
    } catch (error) {
      console.error("[PAYROLL_RECORDS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
