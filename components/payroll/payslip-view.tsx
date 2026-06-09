"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import { cn } from "@/lib/utils"
import { MONTHS, PAYROLL_STATUS_LABELS, PAYROLL_STATUS_COLORS } from "@/lib/constants"
import type { PayrollRecord } from "@/hooks/use-payroll"

interface PayslipViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: PayrollRecord | null
}

function fmt(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function PayslipView({ open, onOpenChange, record }: PayslipViewProps) {
  if (!record) return null

  const monthName = MONTHS[record.month - 1]
  const statusLabel = PAYROLL_STATUS_LABELS[record.status] ?? record.status
  const statusColor = PAYROLL_STATUS_COLORS[record.status] ?? "bg-gray-100 text-gray-700"

  const earnings = [
    { label: "Basic", amount: record.basicSalary },
    { label: "HRA", amount: record.hra },
    { label: "Transport Allowance", amount: record.conveyance },
    { label: "Medical Allowance", amount: record.medicalAllowance },
    { label: "Telephone / Mobile Bill", amount: record.telephoneAllowance },
    { label: "Special Allowance", amount: record.otherAllowances },
    ...(record.overtime > 0 ? [{ label: "Overtime", amount: record.overtime }] : []),
  ].filter((e) => e.amount > 0)

  const deductions = [
    { label: "Provident Fund (Employee)", amount: record.pfEmployee },
    { label: "Provident Fund (Employer)", amount: record.pfEmployer },
    { label: "ESI", amount: record.esi },
    { label: "TDS", amount: record.tds },
    ...(record.otherDeductions > 0
      ? [{ label: "Other Deductions", amount: record.otherDeductions }]
      : []),
  ].filter((d) => d.amount > 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="mb-6">
          <SheetTitle>Payslip</SheetTitle>
        </SheetHeader>

        {/* Printable area */}
        <div id="payslip-print-area" className="space-y-6">
          {/* Company header */}
          <div className="border-b pb-4 text-center">
            <h2 className="text-foreground text-xl font-bold">DNMS</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Payslip for {monthName} {record.year}
            </p>
          </div>

          {/* Status + print */}
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                statusColor,
              )}
            >
              {statusLabel}
            </span>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>

          {/* Employee details */}
          <div className="rounded border p-4">
            <h3 className="text-foreground mb-3 text-sm font-semibold">Employee Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Name</p>
                <p className="font-medium">
                  {record.employee.firstName} {record.employee.lastName}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Employee No</p>
                <p className="font-medium">{record.employee.employeeNo}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Department</p>
                <p className="font-medium">{record.employee.department?.name ?? "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Designation</p>
                <p className="font-medium">{record.employee.designation?.title ?? "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Pay Period</p>
                <p className="font-medium">
                  {monthName} {record.year}
                </p>
              </div>
            </div>
          </div>

          {/* Attendance summary */}
          <div className="rounded border p-4">
            <h3 className="text-foreground mb-3 text-sm font-semibold">Attendance Summary</h3>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="text-center">
                <p className="text-foreground text-2xl font-bold">{record.workingDays}</p>
                <p className="text-muted-foreground mt-1">Days in Month</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {record.presentDays}
                </p>
                <p className="text-muted-foreground mt-1">Paid Days</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {record.lopDays}
                </p>
                <p className="text-muted-foreground mt-1">Unpaid Days</p>
              </div>
            </div>
          </div>

          {/* Earnings table */}
          <div className="overflow-hidden rounded border">
            <div className="bg-muted/40 px-4 py-2.5">
              <h3 className="text-foreground text-sm font-semibold">Earnings</h3>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {earnings.map((e) => (
                  <tr key={e.label}>
                    <td className="text-muted-foreground px-4 py-2.5">{e.label}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/20 border-t">
                <tr>
                  <td className="text-foreground px-4 py-2.5 font-semibold">Gross Earnings</td>
                  <td className="text-foreground px-4 py-2.5 text-right font-bold">
                    {fmt(record.grossSalary)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Deductions table */}
          <div className="overflow-hidden rounded border">
            <div className="bg-muted/40 px-4 py-2.5">
              <h3 className="text-foreground text-sm font-semibold">Deductions</h3>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {deductions.length === 0 ? (
                  <tr>
                    <td className="text-muted-foreground px-4 py-3 italic" colSpan={2}>
                      No deductions
                    </td>
                  </tr>
                ) : (
                  deductions.map((d) => (
                    <tr key={d.label}>
                      <td className="text-muted-foreground px-4 py-2.5">{d.label}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-red-600 dark:text-red-400">
                        {fmt(d.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-muted/20 border-t">
                <tr>
                  <td className="text-foreground px-4 py-2.5 font-semibold">Total Deductions</td>
                  <td className="px-4 py-2.5 text-right font-bold text-red-600 dark:text-red-400">
                    {fmt(record.totalDeductions)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Net salary highlight */}
          <div className="flex items-center justify-between rounded border-2 border-emerald-500 bg-emerald-50 px-4 py-4 dark:border-emerald-600 dark:bg-emerald-950/40">
            <p className="text-base font-bold text-emerald-900 dark:text-emerald-100">Net Salary</p>
            <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
              {fmt(record.netSalary)}
            </p>
          </div>

          {record.notes && (
            <div className="bg-muted/30 text-muted-foreground rounded px-3 py-2 text-sm">
              <span className="font-medium">Notes: </span>
              {record.notes}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
