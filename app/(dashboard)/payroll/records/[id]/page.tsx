"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { ChevronLeft, Download } from "lucide-react"
import { Spinner } from "@/components/shared/spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { usePayrollRecord, PayslipDocument, PayslipSkeleton } from "@/features/payroll"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS, PAYROLL_STATUS_LABELS, PAYROLL_STATUS_COLORS } from "@/lib/constants"
import { cn } from "@/lib/utils"

const NEXT_STATUS: Record<string, string | null> = {
  DRAFT: "PROCESSING",
  PROCESSING: "APPROVED",
  APPROVED: "PAID",
  PAID: null,
}
const inr = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN")}`

export default function PayrollRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { can } = usePermissions()
  const canProcess = can(PERMISSIONS.PAYROLL_PROCESS)
  const { data, isLoading, refetch } = usePayrollRecord(id)
  const r = data?.data

  const [overtime, setOvertime] = useState("")
  const [otherDeductions, setOtherDeductions] = useState("")

  const patchMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/payroll/records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok)
        throw new Error((await res.json().catch(() => ({}))).error?.message || "Update failed")
      return res.json()
    },
    onSuccess: () => {
      refetch()
      toast.success("Payroll record updated")
      setOvertime("")
      setOtherDeductions("")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Only a LOADED-but-missing record is "not found"; while loading we paint the
  // shell and placehold just the data regions.
  if (!isLoading && !r) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="text-muted-foreground">Payroll record not found.</p>
        <Button variant="outline" asChild>
          <Link href="/payroll/payroll-directory">
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Payroll
          </Link>
        </Button>
      </div>
    )
  }

  const monthName = r
    ? new Date(r.year, r.month - 1).toLocaleString("default", { month: "long" })
    : null
  const next = r ? NEXT_STATUS[r.status] : null
  const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
    <div className={cn("flex justify-between py-1.5 text-sm", bold && "border-t font-semibold")}>
      <span className={cn(!bold && "text-muted-foreground")}>{label}</span>
      <span>{value}</span>
    </div>
  )
  /** A label/value line, placeheld - same 1.5-unit row rhythm as <Row>. */
  const RowSkeleton = ({ bold }: { bold?: boolean }) => (
    <div className={cn("flex justify-between py-1.5", bold && "border-t")}>
      <Skeleton className="my-0.5 h-4 w-32" />
      <Skeleton className="my-0.5 h-4 w-16" />
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={r ? `Payslip - ${monthName} ${r.year}` : "Payslip"}
        description={
          r ? (
            `${r.employee.firstName} ${r.employee.lastName} · ${r.employee.employeeNo}`
          ) : (
            <Skeleton className="h-4 w-56" />
          )
        }
        backHref="/payroll/payroll-directory"
        backLabel="Back to Payroll"
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={!r}
            onClick={() => window.print()}
            className="gap-2"
          >
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        {r ? (
          <StatusBadge
            status={r.status}
            colorMap={PAYROLL_STATUS_COLORS}
            labelMap={PAYROLL_STATUS_LABELS}
          />
        ) : (
          <Skeleton className="h-5 w-20 rounded-full" />
        )}
        {r && canProcess && next && (
          <Button
            size="sm"
            disabled={patchMut.isPending}
            onClick={() => patchMut.mutate({ status: next })}
          >
            {patchMut.isPending && <Spinner className="mr-2" />}
            Mark {PAYROLL_STATUS_LABELS[next] ?? next}
          </Button>
        )}
      </div>

      {/* The official payslip (this is what prints / downloads). */}
      <div className="bg-card rounded border p-2 sm:p-4">
        {r ? <PayslipDocument record={r} /> : <PayslipSkeleton />}
      </div>

      {/* HR breakdown - on-screen only (auto-hidden when printing the payslip). */}
      <div className="no-print grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            {r ? (
              <>
                <Row label="Days in month" value={String(r.workingDays)} />
                <Row label="Paid days" value={String(r.presentDays)} />
                <Row label="Paid leave days" value={String(r.leaveDays)} />
                <Row label="Unpaid days (LOP)" value={String(r.lopDays)} />
              </>
            ) : (
              Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            {r ? (
              <>
                <Row label="Basic" value={inr(r.basicSalary)} />
                <Row label="HRA" value={inr(r.hra)} />
                <Row label="Transport Allowance" value={inr(r.conveyance)} />
                <Row label="Medical Allowance" value={inr(r.medicalAllowance)} />
                <Row label="Telephone / Mobile Bill" value={inr(r.telephoneAllowance)} />
                <Row label="Special Allowance" value={inr(r.otherAllowances)} />
                {r.overtime > 0 && <Row label="Overtime" value={inr(r.overtime)} />}
                <Row label="Gross" value={inr(r.grossSalary)} bold />
              </>
            ) : (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <RowSkeleton key={i} />
                ))}
                <RowSkeleton bold />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Deductions</CardTitle>
          </CardHeader>
          <CardContent>
            {r ? (
              <>
                <p className="text-muted-foreground py-2 text-sm italic">
                  No deductions - full salary paid in hand.
                </p>
                {r.otherDeductions > 0 && (
                  <Row label="Other deductions" value={inr(r.otherDeductions)} />
                )}
                <Row label="Total deductions" value={inr(r.totalDeductions)} bold />
              </>
            ) : (
              <>
                <Skeleton className="my-2 h-4 w-64" />
                <RowSkeleton bold />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Net Pay</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full items-center">
            {r ? (
              <p className="text-2xl font-bold">{inr(r.netSalary)}</p>
            ) : (
              <Skeleton className="h-8 w-36" />
            )}
          </CardContent>
        </Card>
      </div>

      {r && canProcess && r.status === "DRAFT" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Adjustments (draft only)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="ot">Overtime (₹)</Label>
              <Input
                id="ot"
                type="number"
                className="w-36"
                placeholder={String(r.overtime)}
                value={overtime}
                onChange={(e) => setOvertime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="od">Other deductions (₹)</Label>
              <Input
                id="od"
                type="number"
                className="w-36"
                placeholder={String(r.otherDeductions)}
                value={otherDeductions}
                onChange={(e) => setOtherDeductions(e.target.value)}
              />
            </div>
            <Button
              disabled={patchMut.isPending || (overtime === "" && otherDeductions === "")}
              onClick={() =>
                patchMut.mutate({
                  ...(overtime !== "" && { overtime: Number(overtime) }),
                  ...(otherDeductions !== "" && { otherDeductions: Number(otherDeductions) }),
                })
              }
            >
              Apply &amp; recompute
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
