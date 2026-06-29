"use client"

import { use } from "react"
import Link from "next/link"
import { ChevronLeft, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { useMyPayslip, PayslipDocument } from "@/features/payroll"
import { MONTHS, PAYROLL_STATUS_COLORS, PAYROLL_STATUS_LABELS } from "@/lib/constants"

export default function MyPayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading } = useMyPayslip(id)
  const record = data?.data

  if (isLoading) return <Skeleton className="h-[600px] rounded" />
  if (!record) {
    return (
      <EmptyState
        title="Payslip not found."
        action={{ label: "Back to My Payslips", href: "/payroll/me" }}
      />
    )
  }

  const monthName = MONTHS[record.month - 1]

  return (
    <div className="space-y-6">
      {/* Toolbar - hidden when printing/saving as PDF. */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/payroll/me" className="flex items-center gap-1.5">
              <ChevronLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">
            Payslip - {monthName} {record.year}
          </h1>
          <StatusBadge
            status={record.status}
            colorMap={PAYROLL_STATUS_COLORS}
            labelMap={PAYROLL_STATUS_LABELS}
          />
        </div>
        <Button size="sm" onClick={() => window.print()} className="gap-2">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <div className="bg-card rounded border p-2 sm:p-4">
        <PayslipDocument record={record} />
      </div>
    </div>
  )
}
