"use client"

import { Check, Trash2, X } from "lucide-react"

import { cn, formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { StatusBadge } from "@/components/shared/status-badge"
import { OYD_CATEGORIES, OYD_STATUS_COLORS, OYD_STATUS_LABELS } from "../constants"
import { levelFor } from "../lib/oyd-rules"
import type { OydFlagView } from "../types"

/** "🟠 Flag 2" for a level, in the colour of that OYD step. */
export function LevelChip({ level, className }: { level: number; className?: string }) {
  const step = levelFor(level)
  if (!step) return null
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold",
        step.color,
        className,
      )}
      title={step.action}
    >
      <span aria-hidden>{step.emoji}</span>
      {step.label}
    </span>
  )
}

export type FlagAction = "confirm" | "reject" | "remove"

/** One flag with its whole story: who raised it, who confirmed or removed it, and why. */
export function FlagCard({
  flag,
  showEmployee,
  onAction,
}: {
  flag: OydFlagView
  /** Off on the employee's own list, where every flag is theirs. */
  showEmployee: boolean
  onAction: (flag: OydFlagView, action: FlagAction) => void
}) {
  const removed = !!flag.removedAt
  const name = `${flag.employee.firstName} ${flag.employee.lastName ?? ""}`.trim()

  return (
    <div
      className={cn(
        "bg-card space-y-2.5 rounded-sm border p-4",
        removed && "bg-muted/30 border-dashed",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {showEmployee && (
          <span className="mr-1 flex items-center gap-2">
            <AvatarDisplay
              src={flag.employee.profilePhoto}
              firstName={flag.employee.firstName}
              lastName={flag.employee.lastName ?? ""}
              size="xs"
            />
            <span className="text-sm font-semibold">{name}</span>
          </span>
        )}
        {flag.status === "CONFIRMED" && flag.level ? (
          <LevelChip level={flag.level} className={cn(removed && "opacity-50")} />
        ) : null}
        {(removed || flag.status !== "CONFIRMED") && (
          <StatusBadge
            status={removed ? "REMOVED" : flag.status}
            colorMap={OYD_STATUS_COLORS}
            labelMap={OYD_STATUS_LABELS}
          />
        )}
        <span className="text-sm font-medium">{OYD_CATEGORIES[flag.category]?.label}</span>
        <span className="text-muted-foreground ml-auto text-xs">{formatDate(flag.createdAt)}</span>
      </div>

      <p className={cn("text-sm whitespace-pre-wrap", removed && "text-muted-foreground")}>
        {flag.note}
      </p>

      <div className="text-muted-foreground space-y-0.5 text-xs">
        <p>
          Raised by {flag.raisedBy.name}
          {flag.reviewedBy && flag.status === "CONFIRMED"
            ? flag.reviewedBy.id === flag.raisedBy.id
              ? " · counted at once"
              : ` · confirmed by ${flag.reviewedBy.name} on ${formatDate(flag.reviewedAt!)}`
            : null}
          {flag.reviewedBy && flag.status === "REJECTED"
            ? ` · not confirmed by ${flag.reviewedBy.name} on ${formatDate(flag.reviewedAt!)}`
            : null}
        </p>
        {flag.status === "REJECTED" && flag.reviewNote && <p>Why: {flag.reviewNote}</p>}
        {removed && (
          <p className="text-foreground/80">
            Removed by {flag.removedBy?.name} on {formatDate(flag.removedAt!)}
            {flag.removeReason ? ` - ${flag.removeReason}` : ""}
          </p>
        )}
      </div>

      {(flag.canReview || flag.canRemove) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {flag.canReview && (
            <>
              <Button className="gap-1.5" onClick={() => onAction(flag, "confirm")}>
                <Check className="h-3.5 w-3.5" /> Confirm
              </Button>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => onAction(flag, "reject")}
              >
                <X className="h-3.5 w-3.5" /> Don&apos;t confirm
              </Button>
            </>
          )}
          {flag.canRemove && (
            <Button
              variant="ghost"
              className="text-muted-foreground gap-1.5"
              onClick={() => onAction(flag, "remove")}
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
