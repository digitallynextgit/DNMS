"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { DateField, toDateString } from "@/components/shared/date-field"
import { useWfhEligibility, useApplyWfh, WfhMailPreview } from "@/features/wfh"
import { useHolidays } from "@/features/attendance"
import { AlertTriangle, Info, Home } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ApplyWfhPage() {
  const router = useRouter()
  const { data: eligibility, isLoading } = useWfhEligibility()
  const apply = useApplyWfh()
  const { data: session } = useSession()
  const applicantName =
    `${session?.user?.firstName ?? ""} ${session?.user?.lastName ?? ""}`.trim() || "You"

  const [date, setDate] = useState("")
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

  // For tier 1 or 2 the request is implicitly an emergency (there is no checkbox -
  // the submit handler forces isEmergency: true), so it only needs a detailed
  // reason. Don't gate canSubmit on the isEmergency state or it can never enable.
  const mustBeEmergency = eligibility?.canApplyEmergencyOnly ?? false
  const canSubmit = !!date && (mustBeEmergency ? reason.trim().length >= 10 : true)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await apply.mutateAsync({
      date,
      reason: reason.trim() || undefined,
      isEmergency: mustBeEmergency ? true : isEmergency,
      // The subject + letter exactly as shown/edited in the preview.
      emailBody: emailBodyRef.current.trim() || undefined,
      emailSubject: emailSubjectRef.current.trim() || undefined,
    })
    router.push("/wfh")
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
            <Skeleton className="h-32 rounded" />
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

          <div className="space-y-2">
            <Label>WFH Date</Label>
            <DateField
              value={date}
              onChange={setDate}
              placeholder="Pick a date"
              startMonth={todayStart}
              disabled={isDateBlocked}
            />
            <p className="text-muted-foreground text-xs">
              WFH is for a single day. Weekends and holidays cannot be selected.
            </p>
          </div>

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
            <div className="flex items-start gap-2 rounded-[2px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs dark:border-amber-800 dark:bg-amber-950/20">
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
            <Label htmlFor="reason">
              Reason{" "}
              {mustBeEmergency ? (
                <span className="text-destructive text-xs">*</span>
              ) : (
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
              onClick={() => router.push("/wfh")}
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
          reason={reason}
          isEmergency={mustBeEmergency ? true : isEmergency}
          applicantName={applicantName}
          onBodyChange={handleBodyChange}
          onSubjectChange={handleSubjectChange}
        />
      </form>
    </div>
  )
}
