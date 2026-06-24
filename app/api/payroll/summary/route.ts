import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

export const GET = withAuth(
  PERMISSIONS.PAYROLL_READ,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { searchParams } = new URL(req.url)
      const month = searchParams.get("month") ? Number(searchParams.get("month")) : undefined
      const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined

      const where: Record<string, unknown> = {}
      if (month) where.month = month
      if (year) where.year = year

      const records = await db.payrollRecord.findMany({
        where,
        select: {
          grossSalary: true,
          netSalary: true,
          totalDeductions: true,
          status: true,
        },
      })

      const totalGross = records.reduce((sum, r) => sum + r.grossSalary, 0)
      const totalNet = records.reduce((sum, r) => sum + r.netSalary, 0)
      const totalDeductions = records.reduce((sum, r) => sum + r.totalDeductions, 0)
      const employeeCount = records.length

      const statusBreakdown: Record<string, number> = {
        DRAFT: 0,
        PROCESSING: 0,
        APPROVED: 0,
        PAID: 0,
      }

      for (const record of records) {
        statusBreakdown[record.status] = (statusBreakdown[record.status] ?? 0) + 1
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
