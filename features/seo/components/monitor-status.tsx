"use client"

import { AlertOctagon, CheckCircle2, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useMonitor, useRunMonitor } from "../hooks/use-seo"

// =============================================================================
// A thin health strip for the daily accident monitor (plan step 9), shown above
// the site report. Green when money pages are up + indexable; red with the
// specific accidents when not. The daily cron keeps this fresh and alerts on
// change; the button forces a check now.
// =============================================================================

export function MonitorStatus({
  projectId,
  propertyId,
  canManage,
}: {
  projectId: string
  propertyId: string | null
  canManage: boolean
}) {
  const { data: monitor } = useMonitor(projectId, propertyId)
  const run = useRunMonitor(projectId)

  if (!monitor) return null

  const bad = monitor.status === "ISSUES"

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded border px-3 py-2 text-xs",
        bad ? "border-red-500/40 bg-red-500/5" : "border-emerald-500/30 bg-emerald-500/5",
      )}
    >
      {bad ? (
        <AlertOctagon className="h-4 w-4 shrink-0 text-red-600" />
      ) : (
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
      )}
      <span className="font-medium">
        {bad
          ? `${monitor.issues.length} money-page issue${monitor.issues.length > 1 ? "s" : ""}`
          : "Money pages healthy"}
      </span>
      <span className="text-muted-foreground">
        {monitor.pagesOk}/{monitor.pagesTotal} pages OK · checked{" "}
        {new Date(monitor.checkedAt).toLocaleString("en-IN")}
      </span>

      {bad && (
        <ul className="w-full space-y-0.5 pt-1">
          {monitor.issues.map((i, idx) => (
            <li key={idx} className="text-red-600">
              {i.detail}{" "}
              <a
                href={i.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground underline"
              >
                {i.url.replace(/^https?:\/\//, "")}
              </a>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-6 px-2 text-xs"
          onClick={() => propertyId && run.mutate(propertyId)}
          disabled={run.isPending || !propertyId}
        >
          {run.isPending ? "Checking…" : "Check now"}
        </Button>
      )}

      {!bad && !canManage && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-600" />}
    </div>
  )
}
