"use client"
import { useState, useMemo, useRef, useCallback } from "react"
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
import { LeaveMailPreview } from "./leave-mail-preview"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { CalendarDays, Info, AlertTriangle, Clock, Sparkles, Undo2, Redo2 } from "lucide-react"
import { toast } from "sonner"

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
  const { data: session } = useSession()
  const applicantName =
    `${session?.user?.firstName ?? ""} ${session?.user?.lastName ?? ""}`.trim() || "You"

  const [leaveTypeId, setLeaveTypeId] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [isHalfDay, setIsHalfDay] = useState(false)
  // AI reason polishing.
  const [polishing, setPolishing] = useState(false)
  const [variants, setVariants] = useState<{ label: string; text: string }[]>([])
  // The exact letter body composed/edited in the preview - sent verbatim as the
  // approval email. A ref (not state) so the preview's live edits don't re-render
  // the whole form on every keystroke.
  const emailBodyRef = useRef("")
  const emailSubjectRef = useRef("")
  const handleBodyChange = useCallback((v: string) => {
    emailBodyRef.current = v
  }, [])
  const handleSubjectChange = useCallback((v: string) => {
    emailSubjectRef.current = v
  }, [])
  // Linear undo/redo history of the reason text. Every AI apply is a checkpoint,
  // so the employee can always step back to their own words (and forward again).
  const [history, setHistory] = useState<string[]>([])
  const [hIndex, setHIndex] = useState(-1)
  const canUndo = hIndex > 0
  const canRedo = hIndex >= 0 && hIndex < history.length - 1

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
      // The subject + letter exactly as shown/edited in the preview.
      emailBody: emailBodyRef.current.trim() || undefined,
      emailSubject: emailSubjectRef.current.trim() || undefined,
    })

    router.push("/leave")
  }

  // Record the current reason as a history checkpoint and set a new value.
  function commitReason(next: string) {
    setHistory((prev) => {
      const base = hIndex >= 0 ? prev.slice(0, hIndex + 1) : []
      // Make sure the words currently on screen are captured before we move on.
      const withCurrent = base.length && base[base.length - 1] === reason ? base : [...base, reason]
      const stack = [...withCurrent, next]
      setHIndex(stack.length - 1)
      return stack
    })
    setReason(next)
  }

  function undoReason() {
    if (!canUndo) return
    const i = hIndex - 1
    setHIndex(i)
    setReason(history[i]!)
  }
  function redoReason() {
    if (!canRedo) return
    const i = hIndex + 1
    setHIndex(i)
    setReason(history[i]!)
  }

  async function suggestReasons() {
    const original = reason.trim()
    if (!original || polishing) return
    setPolishing(true)
    setVariants([])
    try {
      const res = await fetch("/api/leave/polish-reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: original,
          leaveType: selectedType?.name,
          days: totalDays || undefined,
        }),
      })
      const body = await res.json().catch(() => null)
      const list = body?.data?.variants as { label: string; text: string }[] | undefined
      if (!res.ok || !list?.length) {
        throw new Error(body?.error ?? "Couldn't suggest an improvement")
      }
      setVariants(list)
    } catch (e) {
      // AI is a convenience - a failure must never block applying for leave.
      toast.error(e instanceof Error ? e.message : "Couldn't suggest an improvement")
    } finally {
      setPolishing(false)
    }
  }

  return (
    // Two panes: the form on the left, a live preview of the approval mail on
    // the right so the employee can see exactly who it reaches before sending.
    <form onSubmit={handleSubmit} className="grid w-full gap-6 lg:grid-cols-2">
      <div className="space-y-6">
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
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="reason">
              Reason <span className="text-destructive text-xs">*</span>
            </Label>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground h-7 w-7"
                disabled={!canUndo}
                title="Undo"
                onClick={undoReason}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground h-7 w-7"
                disabled={!canRedo}
                title="Redo"
                onClick={redoReason}
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                disabled={!reason.trim() || polishing}
                title="Suggest clearer wording. Pick one, or undo."
                onClick={suggestReasons}
              >
                <Sparkles className={cn("mr-1 h-3 w-3", polishing && "animate-pulse")} />
                {polishing ? "Thinking…" : "Improve with AI"}
              </Button>
            </div>
          </div>
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
            onChange={(e) => {
              const v = e.target.value
              setReason(v)
              // Keep the current history checkpoint in sync with manual edits so
              // Undo returns to the previous checkpoint, not stale AI text.
              if (hIndex >= 0) {
                setHistory((prev) => {
                  const c = [...prev]
                  c[hIndex] = v
                  return c
                })
              }
            }}
            rows={3}
            className="resize-none"
            required
          />

          {/* AI suggestions - the employee picks one, or ignores them. */}
          {variants.length > 0 && (
            <div className="space-y-1.5 rounded-md border p-2">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground flex items-center gap-1 text-[11px] font-medium">
                  <Sparkles className="h-3 w-3" /> Pick a version
                </p>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground text-[11px]"
                  onClick={() => setVariants([])}
                >
                  Dismiss
                </button>
              </div>
              {variants.map((v) => (
                <button
                  key={v.label}
                  type="button"
                  onClick={() => {
                    commitReason(v.text)
                    setVariants([])
                  }}
                  className="hover:bg-muted/60 focus-visible:ring-ring w-full rounded border p-2 text-left transition-colors focus:outline-none focus-visible:ring-2"
                >
                  <span className="text-primary text-[10px] font-semibold tracking-wide uppercase">
                    {v.label}
                  </span>
                  <p className="text-foreground mt-0.5 text-xs leading-relaxed">{v.text}</p>
                </button>
              ))}
            </div>
          )}

          <p className="text-muted-foreground text-[11px]">
            Write it however you like - AI can suggest clearer wording for HR. Your reason is only
            shared with your approvers.
          </p>
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
      </div>

      <LeaveMailPreview
        leaveTypeName={selectedType?.name}
        startDate={startDate}
        endDate={isShortLeave ? startDate : endDate}
        totalDays={totalDays}
        reason={reason}
        applicantName={applicantName}
        onBodyChange={handleBodyChange}
        onSubjectChange={handleSubjectChange}
      />
    </form>
  )
}
