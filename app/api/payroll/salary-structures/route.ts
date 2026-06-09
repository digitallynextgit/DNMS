import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withAuth, hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { totalMonthlyEarnings } from "@/lib/payroll"
import type { Session } from "next-auth"

export const GET = withAuth(
  PERMISSIONS.PAYROLL_READ,
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      // HR (payroll:write) sees all structures; employees only their own.
      const canViewAll = hasPermission(session, PERMISSIONS.PAYROLL_WRITE)
      const structures = await db.salaryStructure.findMany({
        where: canViewAll ? {} : { employeeId: session.user.id },
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
        },
        orderBy: { createdAt: "desc" },
      })

      return NextResponse.json({ data: structures })
    } catch (error) {
      console.error("[SALARY_STRUCTURES_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const POST = withAuth(
  PERMISSIONS.PAYROLL_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const body = await req.json()
      const {
        employeeId,
        basicSalary,
        hra,
        conveyance,
        medicalAllowance,
        telephoneAllowance,
        otherAllowances,
        effectiveFrom,
      } = body

      if (!employeeId || basicSalary === undefined || !effectiveFrom) {
        return NextResponse.json(
          { error: "employeeId, basicSalary, and effectiveFrom are required" },
          { status: 400 },
        )
      }

      const employee = await db.employee.findUnique({
        where: { id: employeeId },
        include: { designation: { select: { title: true, maxMonthlySalary: true } } },
      })
      if (!employee) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 })
      }

      // ── Slab cap: total monthly must not exceed the designation's cap ──
      const total = totalMonthlyEarnings({
        basicSalary: Number(basicSalary),
        hra: Number(hra ?? 0),
        conveyance: Number(conveyance ?? 0),
        medicalAllowance: Number(medicalAllowance ?? 0),
        telephoneAllowance: Number(telephoneAllowance ?? 0),
        otherAllowances: Number(otherAllowances ?? 0),
      })
      const cap = employee.designation?.maxMonthlySalary
      if (cap != null && total > cap) {
        return NextResponse.json(
          {
            error: `Total monthly salary ₹${total.toLocaleString("en-IN")} exceeds the ${employee.designation?.title} cap of ₹${cap.toLocaleString("en-IN")}.`,
          },
          { status: 422 },
        )
      }

      // Check if salary structure already exists for this employee
      const existing = await db.salaryStructure.findUnique({ where: { employeeId } })
      if (existing) {
        return NextResponse.json(
          { error: "A salary structure already exists for this employee. Use PATCH to update it." },
          { status: 409 },
        )
      }

      const structure = await db.salaryStructure.create({
        data: {
          employeeId,
          basicSalary: Number(basicSalary),
          hra: Number(hra ?? 0),
          conveyance: Number(conveyance ?? 0),
          medicalAllowance: Number(medicalAllowance ?? 0),
          telephoneAllowance: Number(telephoneAllowance ?? 0),
          otherAllowances: Number(otherAllowances ?? 0),
          // Company has < 20 employees → no statutory deductions; salary is fully in-hand.
          pfEmployee: 0,
          pfEmployer: 0,
          esi: 0,
          tds: 0,
          effectiveFrom: new Date(effectiveFrom),
        },
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
        },
      })

      return NextResponse.json({ data: structure }, { status: 201 })
    } catch (error) {
      console.error("[SALARY_STRUCTURES_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
