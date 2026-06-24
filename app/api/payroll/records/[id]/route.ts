import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { computeStatutoryDeductions } from "@/features/payroll/payroll"
import { createNotification } from "@/lib/notifications"
import { sendEmail } from "@/lib/mailer"
import type { Session } from "next-auth"

const payrollInclude = {
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
}

export const GET = withAuth(
  PERMISSIONS.PAYROLL_READ,
  async (_req: NextRequest, ctx: { params: { id: string } }, session: Session) => {
    try {
      const { id } = ctx.params

      const record = await db.payrollRecord.findUnique({
        where: { id },
        include: payrollInclude,
      })

      if (!record) {
        return NextResponse.json({ error: "Payroll record not found" }, { status: 404 })
      }

      // Employees may only view their own record; HR (payroll:write) sees all.
      if (
        !hasPermission(session, PERMISSIONS.PAYROLL_WRITE) &&
        record.employeeId !== session.user.id
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      return NextResponse.json({ data: record })
    } catch (error) {
      console.error("[PAYROLL_RECORD_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const PATCH = withAuth(
  PERMISSIONS.PAYROLL_PROCESS,
  async (req: NextRequest, ctx: { params: { id: string } }, session: Session) => {
    try {
      const { id } = ctx.params
      const body = await req.json()

      const existing = await db.payrollRecord.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: "Payroll record not found" }, { status: 404 })
      }

      const { status, notes } = body

      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        DRAFT: ["PROCESSING"],
        PROCESSING: ["APPROVED"],
        APPROVED: ["PAID"],
        PAID: [],
      }

      if (status && !validTransitions[existing.status]?.includes(status)) {
        return NextResponse.json(
          {
            error: `Invalid status transition from ${existing.status} to ${status}. Allowed: ${validTransitions[existing.status]?.join(", ") || "none"}`,
          },
          { status: 400 },
        )
      }

      const updateData: Record<string, unknown> = {}
      if (notes !== undefined) updateData.notes = notes

      // ── Adjustments (overtime / one-off deductions) - DRAFT only ──
      if (
        existing.status === "DRAFT" &&
        (body.overtime !== undefined || body.otherDeductions !== undefined)
      ) {
        const overtime =
          body.overtime !== undefined ? Math.max(0, Number(body.overtime)) : existing.overtime
        const otherDeductions =
          body.otherDeductions !== undefined
            ? Math.max(0, Number(body.otherDeductions))
            : existing.otherDeductions
        const grossSalary =
          existing.basicSalary +
          existing.hra +
          existing.conveyance +
          existing.medicalAllowance +
          existing.otherAllowances +
          overtime
        const { pfEmployee, pfEmployer, esi, tds } = computeStatutoryDeductions({
          basic: existing.basicSalary,
          gross: grossSalary,
        })
        const totalDeductions = pfEmployee + esi + tds + otherDeductions
        Object.assign(updateData, {
          overtime,
          otherDeductions,
          grossSalary,
          pfEmployee,
          pfEmployer,
          esi,
          tds,
          totalDeductions,
          netSalary: Math.max(0, grossSalary - totalDeductions),
        })
      }

      if (status) {
        updateData.status = status
        if (status === "PROCESSING") {
          updateData.processedAt = new Date()
        }
        if (status === "APPROVED") {
          updateData.approvedById = session.user.id
        }
        if (status === "PAID") {
          updateData.paidAt = new Date()
        }
      }

      const updated = await db.payrollRecord.update({
        where: { id },
        data: updateData,
        include: payrollInclude,
      })

      // ── Distribute the payslip when the run is marked PAID ──
      if (status === "PAID") {
        const monthName = new Date(updated.year, updated.month - 1).toLocaleString("default", {
          month: "long",
        })
        await createNotification({
          employeeId: updated.employeeId,
          title: "Payslip Paid",
          message: `Your ${monthName} ${updated.year} salary of ₹${updated.netSalary.toLocaleString("en-IN")} has been paid.`,
          type: "success",
          link: "/payroll/me",
        })
        const emp = await db.employee.findUnique({
          where: { id: updated.employeeId },
          select: { firstName: true, email: true },
        })
        if (emp?.email) {
          await sendEmail({
            to: emp.email,
            subject: `Payslip - ${monthName} ${updated.year}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
                <h2 style="color:#1d4ed8;">Payslip - ${monthName} ${updated.year}</h2>
                <p>Hi ${emp.firstName},</p>
                <p>Your salary for <strong>${monthName} ${updated.year}</strong> has been paid.</p>
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                  <tr><td style="padding:4px 0;">Gross</td><td style="text-align:right;">₹${updated.grossSalary.toLocaleString("en-IN")}</td></tr>
                  <tr><td style="padding:4px 0;">Deductions</td><td style="text-align:right;">- ₹${updated.totalDeductions.toLocaleString("en-IN")}</td></tr>
                  <tr style="border-top:1px solid #e5e7eb;font-weight:600;"><td style="padding:6px 0;">Net Pay</td><td style="text-align:right;">₹${updated.netSalary.toLocaleString("en-IN")}</td></tr>
                </table>
                <p style="color:#666;font-size:13px;">View the full payslip in the HRMS portal.</p>
              </div>`,
            text: `Hi ${emp.firstName}, your ${monthName} ${updated.year} net pay of ₹${updated.netSalary} has been paid. View details in HRMS.`,
          }).catch(() => {})
        }
      }

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[PAYROLL_RECORD_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const DELETE = withAuth(
  PERMISSIONS.PAYROLL_PROCESS,
  async (_req: NextRequest, ctx: { params: { id: string } }, _session: Session) => {
    try {
      const { id } = ctx.params

      const existing = await db.payrollRecord.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: "Payroll record not found" }, { status: 404 })
      }

      if (existing.status !== "DRAFT") {
        return NextResponse.json(
          { error: "Only DRAFT payroll records can be deleted" },
          { status: 409 },
        )
      }

      await db.payrollRecord.delete({ where: { id } })

      return NextResponse.json({ message: "Payroll record deleted successfully" })
    } catch (error) {
      console.error("[PAYROLL_RECORD_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
