"use client"

import { use } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { useMyPayslip, PayslipDocument, PayslipSkeleton } from "@/features/payroll"
import { MONTHS, PAYROLL_STATUS_COLORS, PAYROLL_STATUS_LABELS } from "@/lib/constants"

export default function MyPayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading } = useMyPayslip(id)
  const record = data?.data

  // Only a LOADED-but-missing payslip is "not found"; while loading we paint the
  // shell (back link, title, actions) and placehold just the payslip itself.
  if (!isLoading && !record) {
    return (
      <EmptyState
        title="Payslip not found."
        action={{ label: "Back to My Payslips", href: "/payroll/me" }}
      />
    )
  }

  const monthName = record ? MONTHS[record.month - 1] : null

  return (
    <div className="space-y-6">
      {/* Header - hidden when printing/saving as PDF (the payslip itself is #print-area). */}
      <PageHeader
        className="no-print"
        title={record ? `Payslip - ${monthName} ${record.year}` : "Payslip"}
        backHref="/payroll/me"
        actions={
          <>
            {record ? (
              <StatusBadge
                status={record.status}
                colorMap={PAYROLL_STATUS_COLORS}
                labelMap={PAYROLL_STATUS_LABELS}
              />
            ) : (
              <Skeleton className="h-5 w-20 rounded-full" />
            )}
            <Button size="sm" disabled={!record} onClick={() => window.print()} className="gap-2">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </>
        }
      />

      <div className="bg-card rounded border p-2 sm:p-4">
        {record ? <PayslipDocument record={record} /> : <PayslipSkeleton />}
      </div>
    </div>
  )
}
