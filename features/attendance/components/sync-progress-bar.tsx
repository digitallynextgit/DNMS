"use client"

import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/shared/spinner"
import { cn } from "@/lib/utils"
import { formatDuration, type SyncProgressState } from "../hooks/use-sync-progress"

const PHASE_LABEL: Record<SyncProgressState["phase"], string> = {
  idle: "",
  probing: "Contacting device…",
  fetching: "Reading punches from device",
  writing: "Writing attendance…",
  done: "Sync complete",
  error: "Sync failed",
}

/**
 * Live progress for a device sync: a REAL percentage (the server knows the total
 * window count before it starts walking), an elapsed timer, and an ETA measured from
 * the average time per window so far.
 */
export function SyncProgressBar({
  progress,
  onCancel,
  className,
}: {
  progress: SyncProgressState
  onCancel?: () => void
  className?: string
}) {
  if (progress.phase === "idle") return null

  const running =
    progress.phase === "probing" || progress.phase === "fetching" || progress.phase === "writing"
  // Until the first window lands we have no total, so show an honest indeterminate
  // bar rather than a fabricated percentage.
  const indeterminate = progress.windowsTotal === 0 && running

  return (
    <div className={cn("bg-card space-y-2 rounded-lg border p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {running && <Spinner size="sm" className="text-muted-foreground shrink-0" />}
          <span
            className={cn(
              "truncate font-medium",
              progress.phase === "error" && "text-destructive",
              progress.phase === "done" && "text-green-600 dark:text-green-400",
            )}
          >
            {progress.error ?? progress.message ?? PHASE_LABEL[progress.phase]}
          </span>
          {progress.currentRange && running && (
            <span className="text-muted-foreground hidden shrink-0 font-mono text-xs sm:inline">
              {progress.currentRange}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {!indeterminate && (
            <span className="text-sm font-semibold tabular-nums">{progress.percent}%</span>
          )}
          {running && onCancel && (
            <Button variant="ghost" size="icon-sm" onClick={onCancel} title="Cancel sync">
              <X />
            </Button>
          )}
        </div>
      </div>

      <Progress value={progress.percent} indeterminate={indeterminate} />

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums">
        <span>
          Elapsed{" "}
          <span className="text-foreground font-medium">{formatDuration(progress.elapsedMs)}</span>
        </span>
        {running && (
          <span>
            {/* Honest wording: this is an estimate from the measured average, not a promise. */}~
            <span className="text-foreground font-medium">{formatDuration(progress.etaMs)}</span>{" "}
            remaining
          </span>
        )}
        {progress.windowsTotal > 0 && (
          <span>
            {progress.windowsDone}/{progress.windowsTotal} windows
          </span>
        )}
        {progress.punches > 0 && <span>{progress.punches.toLocaleString()} punches</span>}
      </div>
    </div>
  )
}
