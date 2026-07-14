"use client"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import {
  useEligibleLeaveTypes,
  useLeaveBalances,
  useApplyLeave,
} from "@/features/leave/hooks/use-leave"
import { DateField, parseDateString } from "@/components/shared/date-field"
import { cn } from "@/lib/utils"
import { CalendarDays, Info, AlertTriangle, Clock } from "lucide-react"

// Sandwich rule: count ALL calendar days (weekends between leave days are charged)
function countSandwichDays(start: Date, end: Date): number {
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0
  const s = new Date(start)
  s.setHours(0, 0, 0, 0)
  const e = new Date(end)
  e.setHours(0, 0, 0, 0)
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1
}

// Working days only (for informational display)
function countWorkingDays(start: Date, end: Date): number {
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0
  let count = 0
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)
  const endNorm = new Date(end)
  endNorm.setHours(0, 0, 0, 0)
  while (current <= endNorm) {
    const dow = current.getDay()
    if (dow !== 0 && dow !== 6) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}

export function ApplyLeaveForm() {
  const router = useRouter()
  const applyLeave = useApplyLeave()

  const [leaveTypeId, setLeaveTypeId] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [isHalfDay, setIsHalfDay] = useState(false)

  const { data: typesData, isLoading: typesLoading } = useEligibleLeaveTypes()
  const { data: balancesData } = useLeaveBalances()

  const leaveTypes = typesData?.data ?? []
  const balances = balancesData?.data ?? []

  const currentYear = new Date().getFullYear()
  const selectedType = leaveTypes.find((t) => t.id === leaveTypeId)
  const selectedBalance = useMemo(
    () => balances.find((b) => b.leaveTypeId === leaveTypeId && b.year === currentYear),
    [balances, leaveTypeId, currentYear],
  )

  const calendarDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    if (isHalfDay || selectedType?.code === "SHORT") return 0.5
    return countSandwichDays(new Date(startDate), new Date(endDate))
  }, [startDate, endDate, isHalfDay, selectedType])

  const workingDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    if (isHalfDay || selectedType?.code === "SHORT") return 0.5
    return countWorkingDays(new Date(startDate), new Date(endDate))
  }, [startDate, endDate, isHalfDay, selectedType])

  const sandwichExtra = calendarDays - workingDays
  const totalDays = calendarDays
  // Availability is what has ACCRUED so far (+ carry), matching the server.
  const available = selectedBalance
    ? (Number(selectedBalance.accrued) || 0) +
      (Number(selectedBalance.carried) || 0) -
      (Number(selectedBalance.used) || 0) -
      (Number(selectedBalance.pending) || 0)
    : null
  const isQuotaType = (selectedType?.maxDaysPerYear ?? 0) > 0
  const hasInsufficientBalance =
    isQuotaType && available !== null && totalDays > 0 && available < totalDays

  const todayStart = new Date(new Date().setHours(0, 0, 0, 0))
  const isShortLeave = selectedType?.code === "SHORT"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!leaveTypeId || !startDate || !reason.trim()) return

    await applyLeave.mutateAsync({
      leaveTypeId,
      startDate,
      endDate: isShortLeave ? startDate : endDate,
      reason: reason.trim(),
      isHalfDay: isHalfDay || isShortLeave,
    })

    router.push("/leave")
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      {/* Leave Type */}
      <div className="space-y-2">
        <Label htmlFor="leave-type">Leave Type</Label>
        <Select
          value={leaveTypeId}
          onValueChange={(v) => {
            setLeaveTypeId(v)
            setIsHalfDay(false)
          }}
          disabled={typesLoading}
        >
          <SelectTrigger id="leave-type">
            <SelectValue placeholder={typesLoading ? "Loading..." : "Select leave type"} />
          </SelectTrigger>
          <SelectContent>
            {leaveTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
                {type.isPaid ? " (Paid)" : " (Unpaid)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Available balance - only shown when a balance exists for this type. */}
        {leaveTypeId && selectedBalance && (
          <div
            className={cn(
              "flex items-start gap-2 rounded border px-3 py-2 text-sm",
              hasInsufficientBalance
                ? "bg-destructive/5 border-destructive/20 text-destructive"
                : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
            )}
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Available balance: <strong>{Math.max(0, available ?? 0)} day(s)</strong>
              {selectedBalance.carried > 0 && (
                <> · includes {selectedBalance.carried} carried forward</>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Dates */}
      {!isShortLeave ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <DateField
              value={startDate}
              onChange={(v) => {
                setStartDate(v)
                if (endDate && v && v > endDate) setEndDate(v)
              }}
              disabled={(date) => date < todayStart}
            />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <DateField
              value={endDate}
              onChange={setEndDate}
              disabled={(date) => date < (parseDateString(startDate) ?? todayStart)}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Date</Label>
          <DateField
            value={startDate}
            onChange={setStartDate}
            disabled={(date) => date < todayStart}
          />
        </div>
      )}

      {/* Half-day option (CL / SL / PL only) */}
      {leaveTypeId && !isShortLeave && ["CL", "SL", "PL"].includes(selectedType?.code ?? "") && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="half-day"
            checked={isHalfDay}
            onCheckedChange={(v) => setIsHalfDay(v === true)}
          />
          <Label htmlFor="half-day" className="mb-0 cursor-pointer font-normal">
            Half day
          </Label>
        </div>
      )}

      {/* Day summary */}
      {(totalDays > 0 || isShortLeave) && (
        <Card className="border-dashed">
          <CardContent className="space-y-1.5 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              {isShortLeave ? (
                <Clock className="text-muted-foreground h-4 w-4" />
              ) : (
                <CalendarDays className="text-muted-foreground h-4 w-4" />
              )}
              <span className="text-muted-foreground">Leave days charged:</span>
              <span className="font-semibold">
                {totalDays} day{totalDays !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Sandwich rule info */}
            {sandwichExtra > 0 && (
              <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                Sandwich rule applies: {sandwichExtra} weekend day{sandwichExtra !== 1 ? "s" : ""}{" "}
                between your leave dates are also counted.
              </p>
            )}

            {hasInsufficientBalance && (
              <p className="text-destructive text-xs">
                Insufficient balance - {Math.max(0, available ?? 0)} day(s) available, {totalDays}{" "}
                requested.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reason (required) */}
      <div className="space-y-2">
        <Label htmlFor="reason">
          Reason <span className="text-destructive text-xs">*</span>
        </Label>
        <Textarea
          id="reason"
          placeholder={
            selectedType?.code === "PL"
              ? "Please specify the occasion (e.g., birthday, anniversary, bereavement)..."
              : selectedType?.code === "SL"
                ? "Brief description of illness or medical situation..."
                : "Provide a reason for your leave request..."
          }
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="resize-none"
          required
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/leave")}
          disabled={applyLeave.isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            applyLeave.isPending ||
            !leaveTypeId ||
            !startDate ||
            (!isShortLeave && !endDate) ||
            totalDays === 0 ||
            hasInsufficientBalance ||
            !reason.trim()
          }
        >
          {applyLeave.isPending ? "Submitting..." : "Submit Leave Request"}
        </Button>
      </div>
    </form>
  )
}
