"use client"

import Link from "next/link"
import { FileText, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
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

  return (
    <div className="space-y-6">
      <PageHeader title="My Payslips" description="View your payslip history" />

      {isLoading ? (
        <ListSkeleton rows={5} height="h-16" />
      ) : payslips.length === 0 ? (
        <EmptyState icon={FileText} title="No payslips available yet." />
      ) : (
        <div className="bg-card rounded border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Month</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Year</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Gross</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">
                  Deductions
                </th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Net</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Generated</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payslips.map((payslip: PayrollRecord) => {
                const monthName = MONTHS[payslip.month - 1]

                return (
                  <tr key={payslip.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{monthName}</td>
                    <td className="text-muted-foreground px-4 py-3">{payslip.year}</td>
                    <td className="px-4 py-3 text-right">{fmt(payslip.grossSalary)}</td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {fmt(payslip.totalDeductions)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                      {fmt(payslip.netSalary)}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs whitespace-nowrap">
                      {new Date(payslip.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={payslip.status}
                        colorMap={PAYROLL_STATUS_COLORS}
                        labelMap={PAYROLL_STATUS_LABELS}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" asChild className="gap-1.5">
                        <Link href={`/payroll/me/${payslip.id}`}>
                          <Download className="h-3.5 w-3.5" />
                          View
                        </Link>
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
