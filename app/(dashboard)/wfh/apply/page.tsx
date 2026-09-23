"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTenantPath } from "@/components/tenant-link"
import { useSession } from "next-auth/react"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { DateField, parseDateString, toDateString } from "@/components/shared/date-field"
import { useWfhEligibility, useApplyWfh, WfhMailPreview } from "@/features/wfh"
import { useHolidays } from "@/features/attendance"
import { AlertTriangle, Info, Home } from "lucide-react"
import { cn } from "@/lib/utils"

/** Fallback until eligibility loads; the server is the real authority (MAX_WFH_RANGE_DAYS). */
const MAX_RANGE_DAYS_FALLBACK = 14

export default function ApplyWfhPage() {
  const router = useRouter()
  const tp = useTenantPath()
  const { data: eligibility, isLoading } = useWfhEligibility()
  const apply = useApplyWfh()
  const { data: session } = useSession()
  const applicantName =
    `${session?.user?.firstName ?? ""} ${session?.user?.lastName ?? ""}`.trim() || "You"

  // A request covers `date`..`endDate` inclusive. endDate is optional and falls
  // back to date, so the common single-day case is still one click.
  const [date, setDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [isEmergency, setIsEmergency] = useState(false)

  // The exact subject + letter composed/edited in the preview, sent verbatim as
  // the approval mail. Refs (not state) so the preview's live edits don't
  // re-render the whole form on every keystroke.
  const emailBodyRef = useRef("")
  const emailSubjectRef = useRef("")
  const handleBodyChange = useCallback((v: string) => {
    emailBodyRef.current = v
  }, [])
  const handleSubjectChange = useCallback((v: string) => {
    emailSubjectRef.current = v
  }, [])

  // The calendar greys out exactly what applyWfh() refuses: past days, weekends,
  // and non-optional company holidays. Optional (floating) holidays stay pickable
  // because the server allows them.
  const { data: holidayData } = useHolidays()
  const blockedHolidays = useMemo(() => {
    const set = new Set<string>()
    for (const h of holidayData?.data ?? []) if (!h.isOptional) set.add(h.date.slice(0, 10))
    return set
  }, [holidayData])

  const todayStart = useMemo(() => new Date(new Date().setHours(0, 0, 0, 0)), [])
  const isDateBlocked = useCallback(
    (d: Date) => {
      if (d < todayStart) return true
      const dow = d.getDay()
      if (dow === 0 || dow === 6) return true
      return blockedHolidays.has(toDateString(d))
    },
    [todayStart, blockedHolidays],
  )

  // An empty To means "same day as From", exactly as the server reads it.
  const effectiveEnd = endDate || date

  // Mirror of the server's workingDaysBetween(): weekends and company holidays
  // INSIDE the range are skipped, so Fri-Mon costs 2 days, not 4. Kept in step
  // with applyWfh() so the count shown here is the count that gets charged.
  const { workingDays, spanDays } = useMemo(() => {
    const from = parseDateString(date)
    const to = parseDateString(effectiveEnd)
    if (!from || !to || to < from) return { workingDays: 0, spanDays: 0 }
    let days = 0
    let span = 0
    for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      span += 1
      const dow = d.getDay()
      if (dow === 0 || dow === 6) continue
      if (blockedHolidays.has(toDateString(d))) continue
      days += 1
    }
    return { workingDays: days, spanDays: span }
  }, [date, effectiveEnd, blockedHolidays])

  // For tier 1 or 2 the request is implicitly an emergency (there is no checkbox -
  // the submit handler forces isEmergency: true), so it only needs a detailed
  // reason. Don't gate canSubmit on the isEmergency state or it can never enable.
  const mustBeEmergency = eligibility?.canApplyEmergencyOnly ?? false
  const treatAsEmergency = mustBeEmergency || isEmergency

  const maxRangeDays = eligibility?.maxRangeDays ?? MAX_RANGE_DAYS_FALLBACK
  const tooLong = spanDays > maxRangeDays

  // Tier 3 gets one ORDINARY day a month; an emergency may exceed it (Manager +
  // HR both sign off). This has to match applyWfh() exactly - the banner must
  // never promise days the server will refuse, or the other way round.
  const remainingQuota = Math.max(
    0,
    (eligibility?.monthlyQuota ?? 0) - (eligibility?.usedThisMonth ?? 0),
  )
  const overQuota =
    eligibility?.tier === 3 && !treatAsEmergency && workingDays > 0 && workingDays > remainingQuota

  const canSubmit =
    !!date &&
    workingDays > 0 &&
    !tooLong &&
    !overQuota &&
    (mustBeEmergency ? reason.trim().length >= 10 : true)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await apply.mutateAsync({
        date,
        // Only send a range when it actually is one.
        endDate: effectiveEnd !== date ? effectiveEnd : undefined,
        reason: reason.trim() || undefined,
        isEmergency: treatAsEmergency,
        // The subject + letter exactly as shown/edited in the preview.
        emailBody: emailBodyRef.current.trim() || undefined,
        emailSubject: emailSubjectRef.current.trim() || undefined,
      })
      router.push(tp("/wfh"))
    } catch {
      // the mutation hook already toasts the error; just keep the form open
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apply for Work From Home"
        description="Submit a new WFH request."
        backHref="/wfh"
        backLabel="Back to WFH"
      />

      {/* Two panes, like Apply for Leave: the form on the left, a live preview of
          the request mail on the right so the employee can see exactly who it
          reaches - and edit it - before sending. */}
      <form onSubmit={handleSubmit} className="grid w-full gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {isLoading ? (
            <Skeleton className="h-32 rounded-sm" />
          ) : eligibility ? (
            <Card
              className={cn(
                "border",
                eligibility.tier === 3
                  ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                  : "border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20",
              )}
            >
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                  {eligibility.tier === 3 ? (
                    <Home className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  )}
                  <p className="text-sm font-medium">{eligibility.label}</p>
                </div>
                {eligibility.tier === 3 && (
                  <p className="text-muted-foreground text-xs">
                    Used this month:{" "}
                    <span className="text-foreground font-medium">{eligibility.usedThisMonth}</span>{" "}
                    / {eligibility.monthlyQuota}
                  </p>
                )}
                {eligibility.tier !== 3 && eligibility.eligibleFromDate && (
                  <p className="text-muted-foreground text-xs">
                    Standard eligibility from{" "}
                    <span className="text-foreground font-medium">
                      {new Date(eligibility.eligibleFromDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* From / To, laid out like Apply for Leave. To is optional - leave it
              empty for a single day. */}
          <div className="space-y-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label required>From Date</Label>
                <DateField
                  value={date}
                  onChange={(v) => {
                    setDate(v)
                    // Moving the start past the end would leave an invalid range
                    // on screen; drop the end instead of silently keeping it.
                    if (endDate && v && v > endDate) setEndDate("")
                  }}
                  placeholder="Pick a date"
                  startMonth={todayStart}
                  disabled={isDateBlocked}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  To Date <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <DateField
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="Same day"
                  startMonth={parseDateString(date) ?? todayStart}
                  disabled={(d) => isDateBlocked(d) || d < (parseDateString(date) ?? todayStart)}
                />
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Leave <span className="font-medium">To Date</span> empty for a single day. Weekends
              and holidays inside a range are skipped and not counted.
            </p>
          </div>

          {/* What the range actually costs, and the two ways it can be refused -
              shown here rather than only on submit. */}
          {workingDays > 0 && (
            <div
              className={cn(
                "space-y-1 rounded-sm border px-3 py-2.5 text-xs",
                tooLong || overQuota
                  ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
                  : "bg-muted/40",
              )}
            >
              <p>
                This request covers{" "}
                <span className="font-medium">
                  {workingDays} working day{workingDays !== 1 ? "s" : ""}
                </span>
                {spanDays !== workingDays && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({spanDays - workingDays} weekend/holiday day
                    {spanDays - workingDays !== 1 ? "s" : ""} skipped)
                  </span>
                )}
                .
              </p>
              {tooLong && (
                <p className="text-amber-700 dark:text-amber-400">
                  A single request can span at most {maxRangeDays} days. Please split it up.
                </p>
              )}
              {overQuota && (
                <p className="text-amber-700 dark:text-amber-400">
                  You have {remainingQuota} WFH day{remainingQuota !== 1 ? "s" : ""} left this
                  month. Mark this as an emergency to request more - that needs both Manager and HR
                  approval.
                </p>
              )}
            </div>
          )}

          {!mustBeEmergency && eligibility?.tier === 3 && (
            <div className="flex items-start gap-2">
              <Checkbox
                id="emergency"
                checked={isEmergency}
                onCheckedChange={(v) => setIsEmergency(v === true)}
              />
              <div>
                <Label htmlFor="emergency" className="mb-0 cursor-pointer font-normal">
                  Mark as emergency
                </Label>
                <p className="text-muted-foreground text-xs">
                  Emergency requests still need Manager + HR approval.
                </p>
              </div>
            </div>
          )}

          {mustBeEmergency && (
            <div className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs dark:border-amber-800 dark:bg-amber-950/20">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <div className="space-y-1">
                <p className="font-medium text-amber-800 dark:text-amber-300">Emergency-only WFH</p>
                <ul className="list-inside list-disc space-y-0.5 text-amber-700 dark:text-amber-400">
                  <li>
                    Requires <strong>both Manager and HR</strong> approval
                  </li>
                  <li>Provide a detailed reason (minimum 10 characters)</li>
                  <li>WFH is a privilege, not an entitlement</li>
                </ul>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label required={mustBeEmergency} htmlFor="reason">
              Reason{" "}
              {!mustBeEmergency && (
                <span className="text-muted-foreground font-normal">(optional)</span>
              )}
            </Label>
            <Textarea
              id="reason"
              placeholder={
                mustBeEmergency
                  ? "Describe the emergency in detail (minimum 10 characters)..."
                  : "Briefly mention why you need WFH..."
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-muted-foreground text-[11px]">
              Whatever you write here flows straight into the letter on the right - you can edit
              that letter before submitting.
            </p>
          </div>

          {/* Right-aligned, Cancel then Submit - same as Apply for Leave, so the
              primary action always sits at the far right of the form. */}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(tp("/wfh"))}
              disabled={apply.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={apply.isPending || !canSubmit}>
              {apply.isPending ? "Submitting..." : "Submit WFH Request"}
            </Button>
          </div>
        </div>

        <WfhMailPreview
          date={date}
          endDate={effectiveEnd}
          totalDays={workingDays}
          reason={reason}
          isEmergency={treatAsEmergency}
          applicantName={applicantName}
          onBodyChange={handleBodyChange}
          onSubjectChange={handleSubjectChange}
        />
      </form>
    </div>
  )
}
