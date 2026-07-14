"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatStrip } from "@/components/shared/stat-strip"
import { useSalaryStructures, usePayrollRecords, type PayrollRecord } from "@/features/payroll"
import { PAYROLL_STATUS_COLORS, PAYROLL_STATUS_LABELS } from "@/lib/constants"
import { Wallet, TrendingUp, TrendingDown, Calendar, Inbox, IndianRupee } from "lucide-react"

interface EmployeeSalaryTabProps {
  employeeId: string
}

function fmt(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

export function EmployeeSalaryTab({ employeeId }: EmployeeSalaryTabProps) {
  // All salary structures (filter by employee client-side; API doesn't accept filter)
  const { data: structuresData, isLoading: structuresLoading } = useSalaryStructures()
  // Payroll records - API accepts employeeId
  const { data: payrollData, isLoading: payrollLoading } = usePayrollRecords({
    employeeId,
  })

  const structure = useMemo(
    () => structuresData?.data.find((s) => s.employeeId === employeeId) ?? null,
    [structuresData, employeeId],
  )
  const payslips = payrollData?.data ?? []

  // Earnings / deductions breakdown for current structure
  const earnings = structure
    ? structure.basicSalary +
      structure.hra +
      structure.conveyance +
      structure.medicalAllowance +
      structure.otherAllowances
    : 0
  const deductions = structure ? structure.pfEmployee + structure.esi + structure.tds : 0
  const netMonthly = earnings - deductions
  const annualCTC = earnings * 12

  // Total paid YTD
  const ytdPaid = payslips
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.netSalary, 0)

  const columns: DataTableColumn<PayrollRecord>[] = [
    {
      header: "Period",
      className: "font-medium whitespace-nowrap",
      cell: (p) => (
        <>
          {MONTH_LABELS[p.month - 1]} {p.year}
        </>
      ),
    },
    {
      header: "Days",
      align: "center",
      cell: (p) => (
        <>
          <span className="text-foreground">{p.presentDays}</span>
          <span className="text-muted-foreground">/{p.workingDays}</span>
          {p.lopDays > 0 && <span className="ml-1 text-xs text-red-600">(LOP {p.lopDays})</span>}
        </>
      ),
    },
    {
      header: "Gross",
      align: "right",
      className: "font-medium",
      cell: (p) => fmt(p.grossSalary),
    },
    {
      header: "Deductions",
      align: "right",
      className: "text-red-600",
      cell: (p) => `-${fmt(p.totalDeductions)}`,
    },
    {
      header: "Net",
      align: "right",
      className: "font-semibold",
      cell: (p) => fmt(p.netSalary),
    },
    {
      header: "Status",
      cell: (p) => (
        <StatusBadge
          status={p.status}
          colorMap={PAYROLL_STATUS_COLORS}
          labelMap={PAYROLL_STATUS_LABELS}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Salary Structure ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="text-muted-foreground h-4 w-4" />
          <h3 className="text-foreground text-sm font-semibold">Current Salary Structure</h3>
        </div>

        {structuresLoading ? (
          <Skeleton className="h-48 rounded" />
        ) : !structure ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <Inbox className="text-muted-foreground/40 mx-auto mb-2 h-8 w-8" />
              <p className="text-muted-foreground text-sm">
                No salary structure configured for this employee.
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                HR can set one up from the Salary Structures page.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary strip - single row, divided */}
            <StatStrip
              items={[
                {
                  label: "Net Monthly",
                  value: fmt(netMonthly),
                  icon: IndianRupee,
                  tone: "success",
                },
                { label: "Gross Monthly", value: fmt(earnings), icon: TrendingUp },
                { label: "Annual CTC", value: fmt(annualCTC), icon: Calendar },
                {
                  label: "Effective From",
                  value: formatDate(structure.effectiveFrom),
                  icon: Calendar,
                  isText: true,
                },
              ]}
            />

            {/* Component breakdown */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Earnings */}
              <Card>
                <CardContent className="pt-5">
                  <div className="mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <h4 className="text-sm font-semibold">Earnings</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <LineItem label="Basic Salary" value={fmt(structure.basicSalary)} />
                    <LineItem label="HRA" value={fmt(structure.hra)} />
                    <LineItem label="Conveyance" value={fmt(structure.conveyance)} />
                    <LineItem label="Medical Allowance" value={fmt(structure.medicalAllowance)} />
                    <LineItem label="Other Allowances" value={fmt(structure.otherAllowances)} />
                    <div className="border-border mt-2 flex items-center justify-between border-t pt-2 font-semibold">
                      <span>Gross Earnings</span>
                      <span className="text-green-700 dark:text-green-400">{fmt(earnings)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Deductions */}
              <Card>
                <CardContent className="pt-5">
                  <div className="mb-3 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <h4 className="text-sm font-semibold">Deductions</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <LineItem label="PF (Employee)" value={fmt(structure.pfEmployee)} />
                    <LineItem label="ESI" value={fmt(structure.esi)} />
                    <LineItem label="TDS" value={fmt(structure.tds)} />
                    <div className="border-border mt-2 flex items-center justify-between border-t pt-2 font-semibold">
                      <span>Total Deductions</span>
                      <span className="text-red-700 dark:text-red-400">{fmt(deductions)}</span>
                    </div>
                    <p className="text-muted-foreground pt-1 text-xs">
                      PF (Employer): {fmt(structure.pfEmployer)} - paid by company, not deducted
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* ── Payslip History ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Payslip History
          </h4>
          {ytdPaid > 0 && (
            <p className="text-muted-foreground text-xs">
              YTD paid: <span className="text-foreground font-semibold">{fmt(ytdPaid)}</span>
            </p>
          )}
        </div>

        {payrollLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded" />
            ))}
          </div>
        ) : payslips.length === 0 ? (
          <EmptyState compact title="No payslips generated yet." />
        ) : (
          <DataTable columns={columns} rows={payslips} rowKey={(p) => p.id} showSerial />
        )}
      </div>
    </div>
  )
}

function LineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}
