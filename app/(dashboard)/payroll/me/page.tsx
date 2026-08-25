"use client"

import Link from "next/link"
import { FileText, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { useMyPayslips, type PayrollRecord } from "@/features/payroll"
import { MONTHS, PAYROLL_STATUS_COLORS, PAYROLL_STATUS_LABELS } from "@/lib/constants"

function fmt(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function MyPayslipsPage() {
  const { data, isLoading } = useMyPayslips()

  const payslips = data?.data ?? []

  const columns: DataTableColumn<PayrollRecord>[] = [
    {
      header: "Month",
      className: "font-medium",
      cell: (payslip) => MONTHS[payslip.month - 1],
    },
    {
      header: "Year",
      className: "text-muted-foreground",
      cell: (payslip) => payslip.year,
    },
    {
      header: "Gross",
      align: "right",
      cell: (payslip) => fmt(payslip.grossSalary),
    },
    {
      header: "Deductions",
      align: "right",
      className: "text-red-600",
      cell: (payslip) => fmt(payslip.totalDeductions),
    },
    {
      header: "Net",
      align: "right",
      className: "font-semibold text-emerald-600",
      cell: (payslip) => fmt(payslip.netSalary),
    },
    {
      header: "Generated",
      className: "text-muted-foreground text-xs whitespace-nowrap",
      cell: (payslip) =>
        new Date(payslip.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
    },
    {
      header: "Status",
      cell: (payslip) => (
        <StatusBadge
          status={payslip.status}
          colorMap={PAYROLL_STATUS_COLORS}
          labelMap={PAYROLL_STATUS_LABELS}
        />
      ),
    },
    {
      header: "",
      align: "right",
      cell: (payslip) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href={`/payroll/me/${payslip.id}`}>
              <Download className="h-3.5 w-3.5" />
              View
            </Link>
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="My Payslips" description="View your payslip history" />

      {/* The table renders from the first paint: while `isLoading` it draws
          skeleton rows inside its own real <thead>, so the header, column count
          and S.No column never move when the payslips land. */}
      {isLoading || payslips.length > 0 ? (
        <DataTable
          columns={columns}
          rows={payslips}
          rowKey={(payslip) => payslip.id}
          showSerial
          loading={isLoading}
          // Phones lead with the month and the net figure - the two things you
          // open a payslip list for - with gross/deductions as a footer row.
          mobileCard={(payslip) => (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">
                    {MONTHS[payslip.month - 1]} {payslip.year}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    Generated{" "}
                    {new Date(payslip.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-lg font-bold text-emerald-600">
                    {fmt(payslip.netSalary)}
                  </span>
                  <StatusBadge
                    status={payslip.status}
                    colorMap={PAYROLL_STATUS_COLORS}
                    labelMap={PAYROLL_STATUS_LABELS}
                    size="xs"
                  />
                </div>
              </div>
              <div className="border-border flex items-center gap-4 border-t pt-3">
                <div>
                  <p className="text-muted-foreground text-[10px] tracking-wide uppercase">Gross</p>
                  <p className="text-[13px] font-medium">{fmt(payslip.grossSalary)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                    Deductions
                  </p>
                  <p className="text-[13px] font-medium text-red-600">
                    {fmt(payslip.totalDeductions)}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild className="ml-auto gap-1.5">
                  <Link href={`/payroll/me/${payslip.id}`}>
                    <Download className="h-3.5 w-3.5" />
                    View
                  </Link>
                </Button>
              </div>
            </div>
          )}
        />
      ) : (
        <EmptyState icon={FileText} title="No payslips available yet." />
      )}
    </div>
  )
}
