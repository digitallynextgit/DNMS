"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MONTHS } from "@/lib/constants"
import { useGeneratePayroll } from "@/features/payroll/hooks/use-payroll"

interface GeneratePayrollDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GeneratePayrollDialog({ open, onOpenChange }: GeneratePayrollDialogProps) {
  const now = new Date()
  const [month, setMonth] = useState<string>(String(now.getMonth() + 1))
  const [year, setYear] = useState<string>(String(now.getFullYear()))

  const generateMutation = useGeneratePayroll()

  async function handleConfirm() {
    await generateMutation.mutateAsync({
      month: Number(month),
      year: Number(year),
    })
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Generate Payroll</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                This will generate <strong>DRAFT</strong> payroll records for all active employees
                who have a salary structure configured. Existing records for the selected period
                will be skipped.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gen-month">Month</Label>
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger id="gen-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gen-year">Year</Label>
                  <Input
                    id="gen-year"
                    type="number"
                    min={2020}
                    max={2099}
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  />
                </div>
              </div>

              <p className="text-muted-foreground text-xs">
                Selected period:{" "}
                <strong>
                  {MONTHS[Number(month) - 1]} {year}
                </strong>
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={generateMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={generateMutation.isPending || !month || !year}
          >
            {generateMutation.isPending ? "Generating..." : "Generate Payroll"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
