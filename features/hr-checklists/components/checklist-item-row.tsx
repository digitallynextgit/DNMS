"use client"

import * as React from "react"
import { CalendarClock, ShieldCheck, Lock } from "lucide-react"

import { cn, formatDate } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { StatusBadge } from "@/components/shared/status-badge"
import { CHECKLIST_ITEM_STATE_COLORS, CHECKLIST_ITEM_STATE_LABELS } from "@/lib/constants"
import type { ChecklistItem } from "../types"

/**
 * Done, overdue, or just pending. Derived here rather than stored - "overdue"
 * is a fact about today, and a stored flag would need a job to keep it true.
 */
export function itemState(item: ChecklistItem, now = new Date()): "DONE" | "OVERDUE" | "PENDING" {
  if (item.isDone) return "DONE"
  if (!item.dueDate) return "PENDING"
  const due = new Date(item.dueDate)
  if (Number.isNaN(due.getTime())) return "PENDING"
  // Date-only compare: an item due today is not overdue until today is over.
  const dueUtc = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return nowUtc > dueUtc ? "OVERDUE" : "PENDING"
}

/**
 * One row of a checklist.
 *
 * A CLEARANCE is drawn differently on purpose: it carries a shield, names who
 * must sign, and when the viewer is not that person the checkbox is disabled
 * with the reason rather than hidden. A control that silently is not there
 * reads as a bug; one that says "Finance signs this" explains the process.
 */
export function ChecklistItemRow({
  item,
  canTick,
  disabledReason,
  onToggle,
  isPending,
}: {
  item: ChecklistItem
  canTick: boolean
  /** Shown when canTick is false, e.g. "Only the Finance head can sign this." */
  disabledReason?: string
  onToggle: (done: boolean) => void
  isPending?: boolean
}) {
  const state = itemState(item)
  const isClearance = item.itemKind === "CLEARANCE"

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-2.5",
        isClearance && "bg-muted/30",
        item.isDone && "opacity-70",
      )}
    >
      <Checkbox
        checked={item.isDone}
        disabled={!canTick || isPending}
        onCheckedChange={(next) => onToggle(next === true)}
        aria-label={item.text}
        className="mt-0.5"
        title={!canTick ? disabledReason : undefined}
      />

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {isClearance && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
          <span className={cn("text-sm", item.isDone && "text-muted-foreground line-through")}>
            {item.text}
          </span>
          {isClearance && item.isRequired && !item.isDone && (
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
              blocks relieving
            </span>
          )}
          {!item.isRequired && <span className="text-muted-foreground text-[10px]">optional</span>}
        </div>

        {item.helpText && <p className="text-muted-foreground text-xs">{item.helpText}</p>}

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          {item.assignee ? (
            <span className="flex items-center gap-1.5">
              <AvatarDisplay
                firstName={item.assignee.firstName}
                lastName={item.assignee.lastName}
                src={item.assignee.profilePhoto}
                size="xs"
              />
              {item.assignee.firstName} {item.assignee.lastName}
            </span>
          ) : (
            <span>HR</span>
          )}

          {item.dueDate && (
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              {formatDate(item.dueDate)}
            </span>
          )}

          {item.isDone && item.doneBy && (
            <span>
              signed by {item.doneBy.firstName} {item.doneBy.lastName}
              {item.doneAt && ` · ${formatDate(item.doneAt)}`}
            </span>
          )}

          {!canTick && disabledReason && (
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              {disabledReason}
            </span>
          )}
        </div>

        {item.note && (
          <p className="bg-muted/50 text-muted-foreground rounded-sm px-2 py-1 text-xs">
            {item.note}
          </p>
        )}
      </div>

      <StatusBadge
        status={state}
        colorMap={CHECKLIST_ITEM_STATE_COLORS}
        labelMap={CHECKLIST_ITEM_STATE_LABELS}
        size="xs"
        className="mt-0.5 shrink-0"
      />
    </div>
  )
}
