"use client"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { useLeaveTypes, useLeaveBalances, useApplyLeave } from "@/features/leave/hooks/use-leave"
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

function daysFromToday(dateStr: string): number {
  if (!dateStr) return 999
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return Math.floor((d.getTime() - today.getTime()) / 86400000)
}

const POLICY_NOTES: Record<string, { notice: string; rules: string[] }> = {
  CL: {
    notice: "Requires 2 days advance notice. Late notice = double salary deduction.",
    rules: [
      "Max 2 days per month",
      "Can be combined with Sick Leave but NOT with Earned Leave",
      "Lapses on Dec 31 - no carry-forward or encashment",
    ],
  },
  SL: {
    notice: "SL > 2 days requires a medical certificate from a registered practitioner.",
    rules: [
      "Can be combined with CL but NOT with EL",
      "Minimum half-day per application",
      "Lapses at year end - no carry-forward",
    ],
  },
  EL: {
    notice: "Requires 60 days advance notice.",
    rules: [
      "Minimum 3 days, maximum 7 days per application",
      "7 days in H1 (Jan–Jun) and 7 days in H2 (Jul–Dec)",
      "Cannot be combined with CL or SL",
      "Max 22 days carry-forward accumulation",
      "Eligible only after completing probation + 6 months",
    ],
  },
  PL: {
    notice: "For special personal events only.",
    rules: [
      "Applicable for: birthday (self/spouse/children), marriage, anniversary, bereavement",
      "Cannot be accumulated or encashed",
    ],
  },
  LWP: {
    notice: "Requires 2 days advance notice. Late notice = double salary deduction.",
    rules: [
      "Only for extraordinary circumstances when all balances are exhausted",
      "Salary deduction = monthly salary ÷ month days × leave days",
    ],
  },
  ML: {
    notice: "Available only after 2 years of continuous service.",
    rules: ["Cannot be encashed or carried forward"],
  },
  SHORT: {
    notice: "Each Short Leave = 2 hours (arrive late or leave early) = 0.5 day.",
    rules: [
      "Maximum 2 Short Leaves per month",
      "3rd onwards treated as half-day Leave Without Pay",
    ],
  },
}

export function ApplyLeaveForm() {
  const router = useRouter()
  const applyLeave = useApplyLeave()

  const [leaveTypeId, setLeaveTypeId] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [isHalfDay, setIsHalfDay] = useState(false)

  const { data: typesData, isLoading: typesLoading } = useLeaveTypes()
  const { data: balancesData } = useLeaveBalances()

  const leaveTypes = typesData?.data ?? []
  const balances = balancesData?.data ?? []

  const currentYear = new Date().getFullYear()
  const selectedType = leaveTypes.find((t) => t.id === leaveTypeId)
  const selectedBalance = useMemo(
    () => balances.find((b) => b.leaveTypeId === leaveTypeId && b.year === currentYear),
    [balances, leaveTypeId, currentYear],
  )

  const policyNote = selectedType ? POLICY_NOTES[selectedType.code] : null

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
  const available = selectedBalance
    ? selectedBalance.allocated +
      selectedBalance.carried -
      selectedBalance.used -
      selectedBalance.pending
    : null
  // No-quota types (e.g. Leave Without Pay, maxDaysPerYear === 0) aren't balance-
  // limited - mirror the server, which only enforces balance when maxDaysPerYear > 0.
  const isQuotaType = (selectedType?.maxDaysPerYear ?? 0) > 0
  const hasInsufficientBalance =
    isQuotaType && available !== null && totalDays > 0 && available < totalDays

  // Notice warnings
  const advanceDays = startDate ? daysFromToday(startDate) : 999
  const lateNoticeCL = selectedType?.code === "CL" && advanceDays < 2
  const lateNoticeLWP = selectedType?.code === "LWP" && advanceDays < 2
  const lateNoticeEL = selectedType?.code === "EL" && advanceDays < 60

  const today = new Date().toISOString().split("T")[0]
  const isShortLeave = selectedType?.code === "SHORT"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!leaveTypeId || !startDate) return

    await applyLeave.mutateAsync({
      leaveTypeId,
      startDate,
      endDate: isShortLeave ? startDate : endDate,
      reason: reason.trim() || undefined,
      isHalfDay: isHalfDay || isShortLeave,
    })

    router.push("/leave")
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
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

        {/* Balance info */}
        {leaveTypeId && (
          <div
            className={cn(
              "flex items-start gap-2 rounded border px-3 py-2 text-sm",
              hasInsufficientBalance
                ? "bg-destructive/5 border-destructive/20 text-destructive"
                : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
            )}
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {selectedBalance ? (
              <span>
                Available balance: <strong>{Math.max(0, available ?? 0)} day(s)</strong>
                {selectedBalance.carried > 0 && (
                  <> · includes {selectedBalance.carried} carried forward</>
                )}
              </span>
            ) : (
              <span>
                No balance record found for {currentYear}. Your request will still be submitted.
              </span>
            )}
          </div>
        )}

        {/* Policy notes */}
        {policyNote && (
          <div className="space-y-1.5 rounded border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs dark:border-amber-800 dark:bg-amber-950/20">
            <p className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {policyNote.notice}
            </p>
            <ul className="list-inside list-disc space-y-0.5 text-amber-700 dark:text-amber-400">
              {policyNote.rules.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Dates */}
      {!isShortLeave ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              min={today}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (endDate && e.target.value > endDate) setEndDate(e.target.value)
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              min={startDate || today}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="start-date">Date</Label>
          <Input
            id="start-date"
            type="date"
            min={today}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
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
          <Label htmlFor="half-day" className="cursor-pointer font-normal">
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

      {/* Late notice warnings */}
      {(lateNoticeCL || lateNoticeLWP) && (
        <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Late notice:</strong> You are applying with less than 2 days advance notice. As
            per company policy, a double salary deduction will apply for this leave.
          </span>
        </div>
      )}

      {lateNoticeEL && (
        <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Insufficient notice:</strong> Earned Leave requires 60 days advance notice. This
            request will be rejected.
          </span>
        </div>
      )}

      {/* Reason */}
      <div className="space-y-2">
        <Label htmlFor="reason">
          Reason{" "}
          {["EL", "CL", "SL"].includes(selectedType?.code ?? "") ? (
            <span className="text-destructive text-xs">*</span>
          ) : (
            <span className="text-muted-foreground font-normal">(optional)</span>
          )}
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
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={
            applyLeave.isPending ||
            !leaveTypeId ||
            !startDate ||
            (!isShortLeave && !endDate) ||
            totalDays === 0 ||
            hasInsufficientBalance ||
            lateNoticeEL
          }
        >
          {applyLeave.isPending ? "Submitting..." : "Submit Leave Request"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/leave")}
          disabled={applyLeave.isPending}
        >
          Cancel
        </Button>
        {lateNoticeCL && (
          <p className="text-muted-foreground text-xs">
            Double deduction will be flagged for payroll.
          </p>
        )}
      </div>
    </form>
  )
}
