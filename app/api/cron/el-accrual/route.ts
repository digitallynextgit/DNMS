import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// EL accrual: 1.16 days earned per month per eligible employee
// Eligibility: confirmed + 6 months of service (probationEndDate + 6 months)
// Max carry: 22 days total at any time
// Trigger: call on the 1st of every month via cron-job.org
// Header: Authorization: Bearer <CRON_SECRET>

const EL_MONTHLY_ACCRUAL = 1.16
const EL_MAX_ACCUMULATED = 22

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const currentYear = now.getFullYear()

    // Find the EL leave type
    const elType = await db.leaveType.findUnique({ where: { code: "EL" } })
    if (!elType) {
      return NextResponse.json({ error: "EL leave type not found in database" }, { status: 500 })
    }

    // Eligible employees: active, probation ended, and 6+ months since probation end
    const sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const eligibleEmployees = await db.employee.findMany({
      where: {
        isActive: true,
        status: "ACTIVE",
        OR: [
          // Has explicit probationEndDate and 6 months have passed since it
          { probationEndDate: { lte: sixMonthsAgo } },
          // Or confirmationDate exists and 6 months have passed
          { confirmationDate: { lte: sixMonthsAgo }, probationEndDate: null },
        ],
      },
      select: { id: true, firstName: true, lastName: true, employeeNo: true },
    })

    let accrued = 0
    let capped = 0

    for (const emp of eligibleEmployees) {
      const existing = await db.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: emp.id,
            leaveTypeId: elType.id,
            year: currentYear,
          },
        },
      })

      if (existing) {
        const currentTotal = existing.allocated + existing.carried

        if (currentTotal >= EL_MAX_ACCUMULATED) {
          // Already at cap - skip accrual but record as capped
          capped++
          continue
        }

        await db.leaveBalance.update({
          where: { id: existing.id },
          data: { allocated: { increment: EL_MONTHLY_ACCRUAL } },
        })
      } else {
        // Create new balance record for this year
        await db.leaveBalance.create({
          data: {
            employeeId: emp.id,
            leaveTypeId: elType.id,
            year: currentYear,
            allocated: EL_MONTHLY_ACCRUAL,
            used: 0,
            pending: 0,
            carried: 0,
          },
        })
      }

      accrued++
    }

    return NextResponse.json({
      success: true,
      runAt: now.toISOString(),
      accrued,
      capped,
      skipped: eligibleEmployees.length - accrued - capped,
      accrualRate: EL_MONTHLY_ACCRUAL,
    })
  } catch (error) {
    console.error("[EL_ACCRUAL_CRON]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
