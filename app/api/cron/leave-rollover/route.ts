import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// Year-end leave rollover. Run on Jan 1 (or with ?year=YYYY for the target year).
//   - Only types with carryForward=true carry their remaining balance, capped at
//     maxCarryDays (e.g. EL → max 22). Everything else lapses.
//   - New-year allocation = maxDaysPerYear, except EL (allocated 0 - it accrues
//     monthly via /api/cron/el-accrual).
// Auth: Authorization: Bearer <CRON_SECRET>

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const yearParam = new URL(req.url).searchParams.get("year")
    const newYear = yearParam ? Number(yearParam) : new Date().getFullYear()
    const prevYear = newYear - 1

    const [employees, leaveTypes] = await Promise.all([
      db.employee.findMany({ where: { isActive: true, status: "ACTIVE" }, select: { id: true } }),
      db.leaveType.findMany({ where: { isActive: true } }),
    ])

    let carriedCount = 0
    let processed = 0

    for (const emp of employees) {
      for (const type of leaveTypes) {
        const prev = await db.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: emp.id,
              leaveTypeId: type.id,
              year: prevYear,
            },
          },
        })
        const remaining = prev ? Math.max(0, prev.allocated + prev.carried - prev.used) : 0
        const carried = type.carryForward ? Math.min(remaining, type.maxCarryDays) : 0
        if (carried > 0) carriedCount++
        const allocated = type.code === "EL" ? 0 : type.maxDaysPerYear

        await db.leaveBalance.upsert({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: emp.id,
              leaveTypeId: type.id,
              year: newYear,
            },
          },
          update: { carried },
          create: {
            employeeId: emp.id,
            leaveTypeId: type.id,
            year: newYear,
            allocated,
            used: 0,
            pending: 0,
            carried,
          },
        })
        processed++
      }
    }

    return NextResponse.json({
      success: true,
      year: newYear,
      employees: employees.length,
      leaveTypes: leaveTypes.length,
      balancesProcessed: processed,
      carriedForward: carriedCount,
    })
  } catch (error) {
    console.error("[LEAVE_ROLLOVER_CRON]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
