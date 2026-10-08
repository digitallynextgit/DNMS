import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createNotifications } from "@/lib/notifications"
import { computePayslip } from "@/features/payroll/payroll"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"

// Page size for callers that omit ?page (e.g. an employee's payslip history).
const UNPAGED_LIMIT = 100

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

      const pageParam = searchParams.get("page")
      const { page, limit, skip, take } = resolvePagination(
        { page: pageParam, limit: searchParams.get("limit") },
        pageParam !== null ? 10 : UNPAGED_LIMIT,
      )

      const where: Record<string, unknown> = {}
      if (month) where.month = month
      if (year) where.year = year
      if (status) where.status = status
      if (hasPermission(session, PERMISSIONS.PAYROLL_WRITE)) {
        if (employeeId) where.employeeId = employeeId
      } else {
        where.employeeId = session.user.id
      }
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
        db.payrollRecord.findMany({ where, include, orderBy, skip, take }),
        db.payrollRecord.count({ where }),
      ])

      return NextResponse.json({
        data: records,
        pagination: paginationMeta(total, page, limit),
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

      // Pay model: daily rate = salary / 30. Weekends, company holidays, approved floating holidays and
      // the birthday are paid days off; a working day is paid when present, on approved WFH (a working
      // day, not leave) or on paid leave. Pre-joining days are unpaid; future days count as present.
      const daysInMonth = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate()
      const STANDARD_MONTH_DAYS = 30

      // UTC month boundaries (attendance/holiday/leave dates are stored at UTC midnight).
      const monthStart = new Date(Date.UTC(yearNum, monthNum - 1, 1))
      const monthEnd = new Date(Date.UTC(yearNum, monthNum - 1, daysInMonth, 23, 59, 59, 999))
      const ymd = (d: Date) => d.toISOString().slice(0, 10)
      const monthEndYmd = ymd(monthEnd)
      const todayYmd = new Date().toISOString().slice(0, 10)

      const employeeIdList = employees.map((e) => e.id)

      const [
        monthHolidays,
        existingRecords,
        allAttendanceLogs,
        allApprovedLeaves,
        allFloating,
        allApprovedWfh,
      ] = await Promise.all([
        // Optional holidays stay working days unless the person's floating request was approved.
        db.holiday.findMany({
          where: { date: { gte: monthStart, lte: monthEnd }, isOptional: false },
          select: { date: true },
        }),
        db.payrollRecord.findMany({
          where: { employeeId: { in: employeeIdList }, month: monthNum, year: yearNum },
          select: { employeeId: true },
        }),
        db.attendanceLog.findMany({
          where: {
            employeeId: { in: employeeIdList },
            date: { gte: monthStart, lte: monthEnd },
          },
          select: { employeeId: true, date: true, status: true },
        }),
        db.leaveRequest.findMany({
          where: {
            employeeId: { in: employeeIdList },
            status: "APPROVED",
            startDate: { lte: monthEnd },
            endDate: { gte: monthStart },
          },
          select: {
            employeeId: true,
            startDate: true,
            endDate: true,
            leaveType: { select: { isPaid: true } },
          },
        }),
        db.floatingHolidaySelection.findMany({
          where: {
            employeeId: { in: employeeIdList },
            status: "APPROVED",
            holiday: { date: { gte: monthStart, lte: monthEnd } },
          },
          select: { employeeId: true, holiday: { select: { date: true } } },
        }),
        db.wfhRequest.findMany({
          where: {
            employeeId: { in: employeeIdList },
            status: "APPROVED",
            date: { lte: monthEnd },
            endDate: { gte: monthStart },
          },
          select: { employeeId: true, date: true, endDate: true },
        }),
      ])

      const holidaySet = new Set(monthHolidays.map((h) => ymd(h.date)))
      const isOffDay = (date: Date) => {
        const dow = date.getUTCDay()
        return dow === 0 || dow === 6 || holidaySet.has(ymd(date))
      }

      const existingByEmployee = new Set(existingRecords.map((r) => r.employeeId))

      const attendanceByEmployee = new Map<string, { date: Date; status: string }[]>()
      for (const log of allAttendanceLogs) {
        const arr = attendanceByEmployee.get(log.employeeId)
        if (arr) arr.push(log)
        else attendanceByEmployee.set(log.employeeId, [log])
      }

      type LeaveRow = { startDate: Date; endDate: Date; leaveType: { isPaid: boolean } }
      const leavesByEmployee = new Map<string, LeaveRow[]>()
      for (const leave of allApprovedLeaves) {
        const arr = leavesByEmployee.get(leave.employeeId)
        if (arr) arr.push(leave)
        else leavesByEmployee.set(leave.employeeId, [leave])
      }

      const floatingByEmployee = new Map<string, Date[]>()
      for (const f of allFloating) {
        const arr = floatingByEmployee.get(f.employeeId)
        if (arr) arr.push(f.holiday.date)
        else floatingByEmployee.set(f.employeeId, [f.holiday.date])
      }

      const wfhByEmployee = new Map<string, Set<string>>()
      for (const w of allApprovedWfh) {
        const days = wfhByEmployee.get(w.employeeId) ?? new Set<string>()
        const cur = new Date(
          Date.UTC(w.date.getUTCFullYear(), w.date.getUTCMonth(), w.date.getUTCDate()),
        )
        while (cur <= w.endDate) {
          days.add(ymd(cur))
          cur.setUTCDate(cur.getUTCDate() + 1)
        }
        wfhByEmployee.set(w.employeeId, days)
      }

      const rowsToCreate: {
        employeeId: string
        netSalary: number
        data: Prisma.PayrollRecordCreateManyInput
      }[] = []
      let createdCount = 0
      const skipped: string[] = []
      const notEmployed: string[] = []
      const errors: string[] = []

      for (const employee of employees) {
        try {
          if (existingByEmployee.has(employee.id)) {
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

          const attendanceLogs = attendanceByEmployee.get(employee.id) ?? []
          const attByDay = new Map<string, string>()
          for (const log of attendanceLogs) attByDay.set(ymd(log.date), log.status)

          const approvedLeaves = leavesByEmployee.get(employee.id) ?? []
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

          const floatingOff = new Set<string>()
          const floating = floatingByEmployee.get(employee.id) ?? []
          for (const date of floating) floatingOff.add(ymd(date))
          const wfhDays = wfhByEmployee.get(employee.id) ?? new Set<string>()

          // Month + day only; a 29 Feb birthday has no day off in a non-leap year.
          const dob = employee.dateOfBirth
          const birthdayYmd = dob
            ? `${yearNum}-${String(dob.getUTCMonth() + 1).padStart(2, "0")}-${String(dob.getUTCDate()).padStart(2, "0")}`
            : null

          let payableDays = 0 // days credited (drives the proration ratio)
          let lopDays = 0
          let leaveDaysInMonth = 0
          for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(Date.UTC(yearNum, monthNum - 1, d))
            const key = ymd(date)
            if (joiningYmd && key < joiningYmd) continue
            if (isOffDay(date) || floatingOff.has(key) || key === birthdayYmd) {
              payableDays += 1
              continue
            }
            if (key > todayYmd) {
              payableDays += 1
              continue
            }
            const att = attByDay.get(key)
            if (att === "PRESENT" || att === "LATE" || wfhDays.has(key)) {
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
              lopDays += 1
            }
          }
          payableDays = Math.round(payableDays * 100) / 100
          lopDays = Math.round(lopDays * 100) / 100

          const ratio = payableDays / STANDARD_MONTH_DAYS

          const basicSalary = Math.round(ss.basicSalary * ratio * 100) / 100
          const hra = Math.round(ss.hra * ratio * 100) / 100
          const conveyance = Math.round(ss.conveyance * ratio * 100) / 100
          const medicalAllowance = Math.round(ss.medicalAllowance * ratio * 100) / 100
          const telephoneAllowance = Math.round(ss.telephoneAllowance * ratio * 100) / 100
          const otherAllowances = Math.round(ss.otherAllowances * ratio * 100) / 100
          const overtime = 0

          const otherDeductions = 0

          // Shared with the PATCH editor. Statutory deductions are zeroed inside (the company is under the
          // 20-employee threshold; absences already reduced gross via proration).
          const { grossSalary, pfEmployee, pfEmployer, esi, tds, totalDeductions, netSalary } =
            computePayslip(
              {
                basicSalary,
                hra,
                conveyance,
                medicalAllowance,
                telephoneAllowance,
                otherAllowances,
                overtime,
              },
              otherDeductions,
            )

          rowsToCreate.push({
            employeeId: employee.id,
            netSalary,
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
        } catch (empError) {
          console.error(`[PAYROLL_GENERATE] Error for employee ${employee.id}:`, empError)
          errors.push(employee.id)
        }
      }

      const monthName = new Date(yearNum, monthNum - 1).toLocaleString("default", {
        month: "long",
      })
      const notified: typeof rowsToCreate = []
      if (rowsToCreate.length > 0) {
        try {
          // skipDuplicates guards the (employeeId, month, year) index against a concurrent generate run.
          const result = await db.payrollRecord.createMany({
            data: rowsToCreate.map((r) => r.data),
            skipDuplicates: true,
          })
          createdCount = result.count
          notified.push(...rowsToCreate)
        } catch (batchError) {
          // Fall back to per-row inserts so one bad row can't sink the whole run.
          console.error("[PAYROLL_GENERATE] Batch insert failed, falling back:", batchError)
          for (const row of rowsToCreate) {
            try {
              await db.payrollRecord.create({ data: row.data })
              createdCount++
              notified.push(row)
            } catch (empError) {
              console.error(`[PAYROLL_GENERATE] Error for employee ${row.employeeId}:`, empError)
              errors.push(row.employeeId)
            }
          }
        }
      }

      if (notified.length > 0) {
        await createNotifications(
          notified.map((r) => ({
            employeeId: r.employeeId,
            title: "Payslip Ready",
            message: `Your payslip for ${monthName} ${yearNum} is ready. Net pay: ₹${r.netSalary.toLocaleString("en-IN")}.`,
            type: "success" as const,
            link: "/payroll/me",
          })),
        )
      }

      const notEmployedNote = notEmployed.length ? `, ${notEmployed.length} not yet joined` : ""
      return NextResponse.json(
        {
          message: `Payroll generated: ${createdCount} created, ${skipped.length} skipped (already exist)${notEmployedNote}, ${errors.length} errors`,
          created: createdCount,
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
