"use client"

import Link from "next/link"
import { FileText, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
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

      {isLoading ? (
        <ListSkeleton rows={5} height="h-16" />
      ) : payslips.length === 0 ? (
        <EmptyState icon={FileText} title="No payslips available yet." />
      ) : (
        <DataTable columns={columns} rows={payslips} rowKey={(payslip) => payslip.id} showSerial />
      )}
    </div>
  )
}
