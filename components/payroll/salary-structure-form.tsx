"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  useCreateSalaryStructure,
  useUpdateSalaryStructure,
  type SalaryStructure,
} from "@/hooks/use-payroll"
import { useEmployees } from "@/hooks/use-employees"
import { cn } from "@/lib/utils"

// The six salary brackets (matching the company payslip) with sensible default
// percentages of the monthly gross. HR can edit any percentage; they must total 100%.
const COMPONENTS = [
  { key: "basic", label: "Basic", defaultPct: 50 },
  { key: "hra", label: "HRA", defaultPct: 25 },
  { key: "transport", label: "Transport Allowance", defaultPct: 17.77 },
  { key: "medical", label: "Medical Allowance", defaultPct: 2.23 },
  { key: "telephone", label: "Telephone / Mobile Bill", defaultPct: 3.57 },
  { key: "special", label: "Special Allowance", defaultPct: 1.43 },
] as const

type CompKey = (typeof COMPONENTS)[number]["key"]

const DEFAULT_PCT = Object.fromEntries(COMPONENTS.map((c) => [c.key, c.defaultPct])) as Record<
  CompKey,
  number
>

interface SalaryStructureFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editData?: SalaryStructure | null
}

function n(val: string): number {
  const parsed = parseFloat(val)
  return isNaN(parsed) ? 0 : parsed
}

function fmt(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function SalaryStructureForm({ open, onOpenChange, editData }: SalaryStructureFormProps) {
  const isEdit = !!editData

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("")
  const [gross, setGross] = useState("")
  const [pct, setPct] = useState<Record<CompKey, number>>(DEFAULT_PCT)

  const createMutation = useCreateSalaryStructure()
  const updateMutation = useUpdateSalaryStructure()

  // limit ≤ 100 - the employees API rejects larger and returns an empty list.
  const { data: employeesData } = useEmployees({ limit: 100, status: "ACTIVE" })
  const employees = employeesData?.data ?? []

  // Populate when opening (edit → derive gross + percentages from stored amounts).
  useEffect(() => {
    if (!open) return
    if (editData) {
      const amounts: Record<CompKey, number> = {
        basic: editData.basicSalary,
        hra: editData.hra,
        transport: editData.conveyance,
        medical: editData.medicalAllowance,
        telephone: editData.telephoneAllowance,
        special: editData.otherAllowances,
      }
      const g = COMPONENTS.reduce((s, c) => s + (amounts[c.key] || 0), 0)
      setGross(g ? String(g) : "")
      setPct(
        g > 0
          ? (Object.fromEntries(
              COMPONENTS.map((c) => [c.key, Math.round((amounts[c.key] / g) * 1000) / 10]),
            ) as Record<CompKey, number>)
          : DEFAULT_PCT,
      )
      setSelectedEmployeeId(editData.employeeId)
    } else {
      setGross("")
      setPct(DEFAULT_PCT)
      setSelectedEmployeeId("")
    }
  }, [editData, open])

  const grossNum = n(gross)

  // Each amount = round(gross × pct%). Rounding residual is absorbed into Special
  // so the six components always sum to exactly the gross.
  const amounts = useMemo(() => {
    const a = {} as Record<CompKey, number>
    let allocated = 0
    for (const c of COMPONENTS) {
      if (c.key === "special") continue
      a[c.key] = Math.round((grossNum * (pct[c.key] || 0)) / 100)
      allocated += a[c.key]
    }
    a.special = Math.max(0, grossNum - allocated)
    return a
  }, [grossNum, pct])

  const totalPct = COMPONENTS.reduce((s, c) => s + (Number(pct[c.key]) || 0), 0)
  const pctValid = Math.abs(totalPct - 100) < 0.05
  const netSalary = COMPONENTS.reduce((s, c) => s + (amounts[c.key] || 0), 0)

  const isPending = createMutation.isPending || updateMutation.isPending
  const canSubmit = !!selectedEmployeeId && grossNum > 0 && pctValid && !isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    const payload = {
      employeeId: selectedEmployeeId,
      basicSalary: amounts.basic,
      hra: amounts.hra,
      conveyance: amounts.transport,
      medicalAllowance: amounts.medical,
      telephoneAllowance: amounts.telephone,
      otherAllowances: amounts.special,
      // No user-facing "effective from" - default to today on create, leave
      // the existing date untouched on edit.
      ...(isEdit ? {} : { effectiveFrom: new Date().toISOString().split("T")[0] }),
    }

    if (isEdit && editData) {
      await updateMutation.mutateAsync({ id: editData.id, body: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Salary Structure" : "Add Salary Structure"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Employee */}
          {!isEdit ? (
            <div className="space-y-1.5">
              <Label htmlFor="employeeId">Employee *</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger id="employeeId">
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} - {emp.employeeNo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="bg-muted/50 rounded px-3 py-2 text-sm">
              <span className="font-medium">
                {editData?.employee.firstName} {editData?.employee.lastName}
              </span>
              <span className="text-muted-foreground ml-2">({editData?.employee.employeeNo})</span>
            </div>
          )}

          {/* Gross */}
          <div className="space-y-1.5">
            <Label htmlFor="gross">Monthly Gross Salary (in-hand) *</Label>
            <Input
              id="gross"
              type="number"
              min="0"
              max="10000000"
              step="1"
              placeholder="e.g. 50000"
              value={gross}
              onChange={(e) => {
                // Clamp to a sane monthly ceiling (₹1 crore) so a fat-fingered
                // value can't produce absurd amounts.
                const v = e.target.value
                if (v === "") return setGross("")
                setGross(String(Math.min(Math.max(0, Number(v)), 10000000)))
              }}
            />
            <p className="text-muted-foreground text-xs">
              No deductions - the full amount is paid in hand. It&apos;s split across the brackets
              below by the percentages.
            </p>
          </div>

          <Separator />

          {/* Bracket split */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-foreground text-sm font-semibold">Salary Split</h3>
              <span
                className={cn(
                  "text-xs font-medium",
                  pctValid ? "text-emerald-600" : "text-destructive",
                )}
              >
                Total: {totalPct.toFixed(2)}%{pctValid ? "" : " (must equal 100%)"}
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-muted-foreground grid grid-cols-[1fr_90px_120px] gap-3 px-1 text-xs">
                <span>Component</span>
                <span className="text-right">%</span>
                <span className="text-right">Amount</span>
              </div>
              {COMPONENTS.map((c) => (
                <div
                  key={c.key}
                  className="grid min-w-0 grid-cols-[1fr_80px_110px] items-center gap-3"
                >
                  <Label htmlFor={`pct-${c.key}`} className="min-w-0 truncate text-sm font-normal">
                    {c.label}
                  </Label>
                  <Input
                    id={`pct-${c.key}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className="h-8 text-right"
                    value={pct[c.key]}
                    onChange={(e) => setPct((p) => ({ ...p, [c.key]: n(e.target.value) }))}
                  />
                  {/* min-w-0 + overflow keeps a large amount scrolling inside the cell
                      instead of stretching the whole dialog wider. */}
                  <div className="min-w-0 overflow-x-auto">
                    <span className="text-foreground block text-right text-sm font-medium whitespace-nowrap tabular-nums">
                      {fmt(amounts[c.key] || 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Preview - gross == net, no deductions */}
          <div className="bg-muted/30 grid grid-cols-2 gap-4 rounded border p-4 text-sm">
            <div className="min-w-0">
              <p className="text-muted-foreground">Gross (= Net, no deductions)</p>
              <p className="overflow-x-auto text-base font-bold whitespace-nowrap text-emerald-600">
                {fmt(netSalary)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground">Deductions</p>
              <p className="text-foreground font-semibold">₹0</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isPending ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
