"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { StatusBadge } from "@/components/shared/status-badge"
import { PAYROLL_STATUS_LABELS, PAYROLL_STATUS_COLORS } from "@/lib/constants"
import { PayslipDocument } from "@/features/payroll/components/payslip-document"
import type { PayrollRecord } from "@/features/payroll/hooks/use-payroll"

interface PayslipViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: PayrollRecord | null
}

export function PayslipView({ open, onOpenChange, record }: PayslipViewProps) {
  if (!record) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {/* Toolbar - hidden when printing/saving as PDF. */}
        <SheetHeader className="no-print mb-4 flex-row items-center justify-between gap-2 space-y-0">
          <SheetTitle className="flex items-center gap-3">
            Payslip
            <StatusBadge
              status={record.status}
              colorMap={PAYROLL_STATUS_COLORS}
              labelMap={PAYROLL_STATUS_LABELS}
            />
          </SheetTitle>
          <Button size="sm" onClick={() => window.print()} className="mr-8 gap-2">
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </SheetHeader>

        <PayslipDocument record={record} />
      </SheetContent>
    </Sheet>
  )
}
