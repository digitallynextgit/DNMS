import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import type { Session } from "next-auth"

export const GET = withSession(
  async (_req: NextRequest, ctx: { params: { id: string } }, session: Session) => {
    try {
      const { id } = ctx.params
      const employeeId = session.user.id

      const record = await db.payrollRecord.findUnique({
        where: { id },
        include: {
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
          salaryStructure: {
            select: {
              id: true,
              basicSalary: true,
              effectiveFrom: true,
            },
          },
        },
      })

      if (!record) {
        return NextResponse.json({ error: "Payslip not found" }, { status: 404 })
      }

      // Employees can only access their own payslips
      if (record.employeeId !== employeeId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      return NextResponse.json({ data: record })
    } catch (error) {
      console.error("[PAYROLL_ME_ID_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
