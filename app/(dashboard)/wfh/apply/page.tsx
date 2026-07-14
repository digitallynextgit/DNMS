"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { useWfhEligibility, useApplyWfh } from "@/features/wfh"
import { ArrowLeft, AlertTriangle, Info, Home } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ApplyWfhPage() {
  const router = useRouter()
  const { data: eligibility, isLoading } = useWfhEligibility()
  const apply = useApplyWfh()

  const [date, setDate] = useState("")
  const [reason, setReason] = useState("")
  const [isEmergency, setIsEmergency] = useState(false)

  const today = new Date().toISOString().split("T")[0]

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
    })
    router.push("/wfh")
  }

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader
        title="Apply for Work From Home"
        description="Submit a new WFH request."
        actions={
          <Button variant="outline" asChild>
            <Link href="/wfh" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-32 rounded-lg" />
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
                <span className="text-foreground font-medium">{eligibility.usedThisMonth}</span> /{" "}
                {eligibility.monthlyQuota}
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="wfh-date">WFH Date</Label>
          <Input
            id="wfh-date"
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
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
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs dark:border-amber-800 dark:bg-amber-950/20">
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
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={apply.isPending || !canSubmit}>
            {apply.isPending ? "Submitting..." : "Submit WFH Request"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/wfh")}
            disabled={apply.isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
