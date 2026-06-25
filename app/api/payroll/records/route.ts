import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"
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
      const page = Math.max(1, Number(pageParam) || 1)
      const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 10))
      const skip = (page - 1) * limit

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
        pagination: {
          total,
          page: paginate ? page : 1,
          limit: paginate ? limit : total,
          totalPages: paginate ? Math.max(1, Math.ceil(total / limit)) : 1,
        },
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

      // Pay model: a flat 1/30 of the monthly salary per day (fixed 30-day
      // divisor), paid across the actual calendar days of the month minus unpaid
      // days. So a 31-day month pays salary×31/30, a 28-day month salary×28/30,
      // and one unpaid day docks exactly salary/30.
      const daysInMonth = new Date(yearNum, monthNum, 0).getDate()
      const STANDARD_MONTH_DAYS = 30

      // Month boundaries for attendance and leave queries
      const monthStart = new Date(yearNum, monthNum - 1, 1)
      const monthEnd = new Date(yearNum, monthNum, 0, 23, 59, 59, 999)

      const created: string[] = []
      const skipped: string[] = []
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

          // Fetch attendance logs for this employee in this month
          const attendanceLogs = await db.attendanceLog.findMany({
            where: {
              employeeId: employee.id,
              date: { gte: monthStart, lte: monthEnd },
            },
          })

          // Fetch approved leaves for this employee in this month
          const approvedLeaves = await db.leaveRequest.findMany({
            where: {
              employeeId: employee.id,
              status: "APPROVED",
              OR: [{ startDate: { lte: monthEnd }, endDate: { gte: monthStart } }],
            },
            include: { leaveType: { select: { code: true } } },
          })

          // Count approved leave days that fall in this month. LWP (unpaid) is
          // tracked separately so it never counts as a paid/earned day.
          let leaveDaysInMonth = 0
          let lwpDays = 0
          for (const leave of approvedLeaves) {
            const leaveStart = leave.startDate > monthStart ? leave.startDate : monthStart
            const leaveEnd = leave.endDate < monthEnd ? leave.endDate : monthEnd
            // Count business days in this range
            const start = new Date(leaveStart)
            const end = new Date(leaveEnd)
            const curr = new Date(start)
            let days = 0
            while (curr <= end) {
              const day = curr.getDay()
              if (day !== 0 && day !== 6) days++
              curr.setDate(curr.getDate() + 1)
            }
            if (leave.leaveType.code === "LWP") lwpDays += days
            else leaveDaysInMonth += days
          }

          // ── Unpaid (loss-of-pay) days ──────────────────────────────────────
          // Each unpaid day docks a flat 1/30 of the monthly salary. Unpaid =
          // LWP + absences NOT covered by approved paid leave (half-day = 0.5).
          // Approved PAID leave is fully paid. No attendance data → only LWP docks.
          let lopDays = lwpDays
          if (attendanceLogs.length > 0) {
            const absentDays = attendanceLogs.filter((l) => l.status === "ABSENT").length
            const halfDays = attendanceLogs.filter((l) => l.status === "HALF_DAY").length
            lopDays += absentDays + 0.5 * halfDays
          }
          lopDays = Math.min(lopDays, daysInMonth)

          // Pay = (monthly salary ÷ 30) × (calendar days in month − unpaid days).
          const payableDays = Math.max(0, daysInMonth - lopDays)
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

      return NextResponse.json(
        {
          message: `Payroll generated: ${created.length} created, ${skipped.length} skipped (already exist), ${errors.length} errors`,
          created: created.length,
          skipped: skipped.length,
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
