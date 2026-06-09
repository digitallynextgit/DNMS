"use client"

import { useState } from "react"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { PayslipView } from "@/components/payroll/payslip-view"
import { useMyPayslips, useMyPayslip, type PayrollRecord } from "@/hooks/use-payroll"
import { cn } from "@/lib/utils"
import { MONTHS, PAYROLL_STATUS_COLORS, PAYROLL_STATUS_LABELS } from "@/lib/constants"

function fmt(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function MyPayslipsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data, isLoading } = useMyPayslips()
  const { data: payslipDetail } = useMyPayslip(selectedId)

  const payslips = data?.data ?? []

  function handleView(id: string) {
    setSelectedId(id)
    setSheetOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Payslips" description="View your payslip history" />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded" />
          ))}
        </div>
      ) : payslips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="text-muted-foreground/50 mb-4 h-12 w-12" />
          <p className="text-muted-foreground text-sm">No payslips available yet.</p>
        </div>
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
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payslips.map((payslip: PayrollRecord) => {
                const statusColor =
                  PAYROLL_STATUS_COLORS[payslip.status] ?? "bg-gray-100 text-gray-700"
                const statusLabel = PAYROLL_STATUS_LABELS[payslip.status] ?? payslip.status
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
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          statusColor,
                        )}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => handleView(payslip.id)}>
                        View
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <PayslipView
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setSelectedId(null)
        }}
        record={payslipDetail?.data ?? null}
      />
    </div>
  )
}
