import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// PAYROLL_WRITE (HR), not PAYROLL_READ: the base employee role holds
// payroll:read for their own payslip, and this route exposes company-wide
// aggregates that must not leak to every staffer (SEC-08).
export const GET = withAuth(
  PERMISSIONS.PAYROLL_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { searchParams } = new URL(req.url)
      const month = searchParams.get("month") ? Number(searchParams.get("month")) : undefined
      const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined

      const where: Record<string, unknown> = {}
      if (month) where.month = month
      if (year) where.year = year

      // Aggregate in the DB (PERF-07) instead of pulling every matching row into
      // memory - with no month/year filter that was the entire payroll history
      // just to produce four totals and a status count.
      const [totals, byStatus] = await Promise.all([
        db.payrollRecord.aggregate({
          where,
          _sum: { grossSalary: true, netSalary: true, totalDeductions: true },
          _count: true,
        }),
        db.payrollRecord.groupBy({ by: ["status"], where, _count: true }),
      ])

      const totalGross = totals._sum.grossSalary ?? 0
      const totalNet = totals._sum.netSalary ?? 0
      const totalDeductions = totals._sum.totalDeductions ?? 0
      const employeeCount = totals._count

      const statusBreakdown: Record<string, number> = {
        DRAFT: 0,
        PROCESSING: 0,
        APPROVED: 0,
        PAID: 0,
      }
      for (const g of byStatus) {
        statusBreakdown[g.status] = g._count
      }

      return NextResponse.json({
        data: {
          totalGross,
          totalNet,
          totalDeductions,
          employeeCount,
          statusBreakdown,
          month,
          year,
        },
      })
    } catch (error) {
      console.error("[PAYROLL_SUMMARY_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
