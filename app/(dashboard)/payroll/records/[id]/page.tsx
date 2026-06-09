"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { ChevronLeft, Loader2, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { usePayrollRecord } from "@/hooks/use-payroll"
import { usePermissions } from "@/hooks/use-permissions"
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
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Update failed")
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

  if (isLoading) return <Skeleton className="h-96 rounded" />
  if (!r) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="text-muted-foreground">Payroll record not found.</p>
        <Button variant="outline" asChild>
          <Link href="/payroll">
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Payroll
          </Link>
        </Button>
      </div>
    )
  }

  const monthName = new Date(r.year, r.month - 1).toLocaleString("default", { month: "long" })
  const next = NEXT_STATUS[r.status]
  const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
    <div className={cn("flex justify-between py-1.5 text-sm", bold && "border-t font-semibold")}>
      <span className={cn(!bold && "text-muted-foreground")}>{label}</span>
      <span>{value}</span>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Payslip - ${monthName} ${r.year}`}
        description={`${r.employee.firstName} ${r.employee.lastName} · ${r.employee.employeeNo}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
              <Printer className="h-4 w-4" /> Print / PDF
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/payroll" className="flex items-center gap-1.5">
                <ChevronLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-3">
        <Badge variant="outline" className={cn("text-xs", PAYROLL_STATUS_COLORS[r.status])}>
          {PAYROLL_STATUS_LABELS[r.status] ?? r.status}
        </Badge>
        {canProcess && next && (
          <Button
            size="sm"
            disabled={patchMut.isPending}
            onClick={() => patchMut.mutate({ status: next })}
          >
            {patchMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mark {PAYROLL_STATUS_LABELS[next] ?? next}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Days in month" value={String(r.workingDays)} />
            <Row label="Paid days" value={String(r.presentDays)} />
            <Row label="Paid leave days" value={String(r.leaveDays)} />
            <Row label="Unpaid days (LOP)" value={String(r.lopDays)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Basic" value={inr(r.basicSalary)} />
            <Row label="HRA" value={inr(r.hra)} />
            <Row label="Transport Allowance" value={inr(r.conveyance)} />
            <Row label="Medical Allowance" value={inr(r.medicalAllowance)} />
            <Row label="Telephone / Mobile Bill" value={inr(r.telephoneAllowance)} />
            <Row label="Special Allowance" value={inr(r.otherAllowances)} />
            {r.overtime > 0 && <Row label="Overtime" value={inr(r.overtime)} />}
            <Row label="Gross" value={inr(r.grossSalary)} bold />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Deductions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground py-2 text-sm italic">
              No deductions - full salary paid in hand.
            </p>
            {r.otherDeductions > 0 && (
              <Row label="Other deductions" value={inr(r.otherDeductions)} />
            )}
            <Row label="Total deductions" value={inr(r.totalDeductions)} bold />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Net Pay</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full items-center">
            <p className="text-2xl font-bold">{inr(r.netSalary)}</p>
          </CardContent>
        </Card>
      </div>

      {canProcess && r.status === "DRAFT" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Adjustments (draft only)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
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
