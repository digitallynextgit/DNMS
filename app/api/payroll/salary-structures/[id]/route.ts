import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withAuth } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { totalMonthlyEarnings } from "@/lib/payroll"
import type { Session } from "next-auth"

export const GET = withAuth(
  PERMISSIONS.PAYROLL_WRITE,
  async (_req: NextRequest, ctx: { params: { id: string } }, _session: Session) => {
    try {
      const { id } = ctx.params

      const structure = await db.salaryStructure.findUnique({
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
        },
      })

      if (!structure) {
        return NextResponse.json({ error: "Salary structure not found" }, { status: 404 })
      }

      return NextResponse.json({ data: structure })
    } catch (error) {
      console.error("[SALARY_STRUCTURE_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const PATCH = withAuth(
  PERMISSIONS.PAYROLL_WRITE,
  async (req: NextRequest, ctx: { params: { id: string } }, _session: Session) => {
    try {
      const { id } = ctx.params
      const body = await req.json()

      const existing = await db.salaryStructure.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: "Salary structure not found" }, { status: 404 })
      }

      const {
        basicSalary,
        hra,
        conveyance,
        medicalAllowance,
        telephoneAllowance,
        otherAllowances,
        effectiveFrom,
      } = body

      // ── Slab cap check against the designation's max monthly salary ──
      const emp = await db.employee.findUnique({
        where: { id: existing.employeeId },
        include: { designation: { select: { title: true, maxMonthlySalary: true } } },
      })
      const total = totalMonthlyEarnings({
        basicSalary: basicSalary !== undefined ? Number(basicSalary) : existing.basicSalary,
        hra: hra !== undefined ? Number(hra) : existing.hra,
        conveyance: conveyance !== undefined ? Number(conveyance) : existing.conveyance,
        medicalAllowance:
          medicalAllowance !== undefined ? Number(medicalAllowance) : existing.medicalAllowance,
        telephoneAllowance:
          telephoneAllowance !== undefined
            ? Number(telephoneAllowance)
            : existing.telephoneAllowance,
        otherAllowances:
          otherAllowances !== undefined ? Number(otherAllowances) : existing.otherAllowances,
      })
      const cap = emp?.designation?.maxMonthlySalary
      if (cap != null && total > cap) {
        return NextResponse.json(
          {
            error: `Total monthly salary ₹${total.toLocaleString("en-IN")} exceeds the ${emp?.designation?.title} cap of ₹${cap.toLocaleString("en-IN")}.`,
          },
          { status: 422 },
        )
      }

      const updated = await db.salaryStructure.update({
        where: { id },
        data: {
          ...(basicSalary !== undefined && { basicSalary: Number(basicSalary) }),
          ...(hra !== undefined && { hra: Number(hra) }),
          ...(conveyance !== undefined && { conveyance: Number(conveyance) }),
          ...(medicalAllowance !== undefined && { medicalAllowance: Number(medicalAllowance) }),
          ...(telephoneAllowance !== undefined && {
            telephoneAllowance: Number(telephoneAllowance),
          }),
          ...(otherAllowances !== undefined && { otherAllowances: Number(otherAllowances) }),
          // No statutory deductions for this company - always zero.
          pfEmployee: 0,
          pfEmployer: 0,
          esi: 0,
          tds: 0,
          ...(effectiveFrom !== undefined && { effectiveFrom: new Date(effectiveFrom) }),
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

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[SALARY_STRUCTURE_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const DELETE = withAuth(
  PERMISSIONS.PAYROLL_WRITE,
  async (_req: NextRequest, ctx: { params: { id: string } }, _session: Session) => {
    try {
      const { id } = ctx.params

      const existing = await db.salaryStructure.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: "Salary structure not found" }, { status: 404 })
      }

      // Check if any payroll records reference this salary structure
      const referencedRecords = await db.payrollRecord.count({
        where: { salaryStructureId: id },
      })

      if (referencedRecords > 0) {
        return NextResponse.json(
          { error: "Cannot delete: payroll records are referencing this salary structure" },
          { status: 409 },
        )
      }

      await db.salaryStructure.delete({ where: { id } })

      return NextResponse.json({ message: "Salary structure deleted successfully" })
    } catch (error) {
      console.error("[SALARY_STRUCTURE_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
