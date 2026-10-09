"use client"

import * as React from "react"
import { Paperclip, Link2, Plus, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { dueLabel, dueTone, type DueTone } from "../../lib/calendar-months"
import {
  isOutstanding,
  STATUS_LABEL,
  teamProgress,
  type WorkbookTeamStatus,
} from "../../lib/workbook-team-progress"
import type { WorkbookTeam } from "../../lib/sheet-types"
import { MemberAvatars } from "./person-bits"

// Read-only on purpose: an editing panel would push the grid below the fold; the side panel edits.

const STATUS_CLASS: Record<WorkbookTeamStatus, string> = {
  TODO: "text-muted-foreground",
  IN_PROGRESS: "text-sky-600 dark:text-sky-400",
  DONE: "text-emerald-600 dark:text-emerald-400",
  STUCK: "text-destructive",
  DISCARDED: "text-muted-foreground/60 line-through",
}

const TONE_CLASS: Record<DueTone, string> = {
  overdue: "text-destructive",
  today: "text-amber-600 dark:text-amber-500",
  soon: "text-amber-600 dark:text-amber-500",
  later: "text-muted-foreground",
  none: "text-muted-foreground/60",
}

/** Today as "YYYY-MM-DD", in the reader's own timezone. */
function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function TeamPlanStrip({
  teams,
  periodMonth,
  myTeamIds,
  canPlan,
  onOpen,
}: {
  teams: WorkbookTeam[]
  periodMonth: string | null
  /** Every team the viewer is on (or manages) on this project. */
  myTeamIds: ReadonlySet<string>
  canPlan: boolean
  onOpen: (focusTeamId?: string) => void
}) {
  const today = React.useMemo(() => localToday(), [])

  // The viewer's own teams first; both halves keep catalogue order.
  const ordered = React.useMemo(
    () => [
      ...teams.filter((t) => myTeamIds.has(t.teamId)),
      ...teams.filter((t) => !myTeamIds.has(t.teamId)),
    ],
    [teams, myTeamIds],
  )

  const overdue = React.useMemo(
    () =>
      teams.filter(
        (t) => isOutstanding(t.status) && dueTone(t.dueOn, periodMonth, today) === "overdue",
      ).length,
    [teams, periodMonth, today],
  )

  if (teams.length === 0) {
    return (
      <div className="border-border flex flex-wrap items-center gap-2 border-b pb-2 text-xs">
        <span className="font-medium">Team plan</span>
        <span className="text-muted-foreground">Nobody is on the hook for this month yet.</span>
        {canPlan && (
          <Button
            variant="ghost"
            className="ml-auto h-7 gap-1 px-2 text-xs"
            onClick={() => onOpen()}
          >
            <Plus className="h-3.5 w-3.5" /> Add a team
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="border-border space-y-1.5 border-b pb-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium">Team plan</span>
        {/* Hidden at zero: a counter that always reads zero stops being seen. */}
        {overdue > 0 && (
          <span className="text-destructive flex items-center gap-1">
            <TriangleAlert className="h-3.5 w-3.5" />
            {overdue} overdue
          </span>
        )}
        <Button variant="ghost" className="ml-auto h-7 gap-1 px-2 text-xs" onClick={() => onOpen()}>
          {canPlan ? (
            <>
              <Plus className="h-3.5 w-3.5" /> Manage plan
            </>
          ) : (
            "See the plan"
          )}
        </Button>
      </div>

      <div className="no-scrollbar flex items-stretch gap-2 overflow-x-auto">
        {ordered.map((t) => {
          const tone = dueTone(t.dueOn, periodMonth, today)
          const isMine = myTeamIds.has(t.teamId)
          const progress = teamProgress(t)
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpen(t.teamId)}
              aria-label={[
                t.teamName,
                STATUS_LABEL[t.status],
                progress.quantity > 0
                  ? `${progress.handedIn} of ${progress.quantity} handed in`
                  : "no quantity set",
                isOutstanding(t.status) ? dueLabel(t.dueOn, tone, today).toLowerCase() : null,
                `${t.members.length} ${t.members.length === 1 ? "person" : "people"}`,
                "Open the team plan.",
              ]
                .filter(Boolean)
                .join(", ")}
              className={cn(
                "border-border hover:bg-foreground/5 w-52 shrink-0 rounded-sm border p-2.5 text-left transition-colors",
                isMine && "ring-primary/40 ring-1",
              )}
            >
              <span className="flex items-baseline gap-1.5">
                <span className="truncate text-xs font-medium">{t.teamName}</span>
                {isMine && <span className="text-primary text-[10px] font-medium">· You ·</span>}
                <span className="ml-auto text-sm leading-none font-semibold tabular-nums">
                  {progress.quantity > 0 ? (
                    <>
                      <span
                        className={cn(
                          progress.canComplete && "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {progress.handedIn}
                      </span>
                      <span className="text-muted-foreground font-normal">
                        /{progress.quantity}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
              </span>

              {/* Words as well as colour; a finished or dropped row shows its status instead of a deadline. */}
              {isOutstanding(t.status) ? (
                <span className={cn("mt-1 flex items-center gap-1 text-[11px]", TONE_CLASS[tone])}>
                  {(tone === "overdue" || tone === "today" || tone === "soon") && (
                    <TriangleAlert className="h-3 w-3 shrink-0" />
                  )}
                  {t.status === "STUCK" ? (
                    <span className="text-destructive font-medium">Stuck</span>
                  ) : (
                    dueLabel(t.dueOn, tone, today)
                  )}
                </span>
              ) : (
                <span className={cn("mt-1 block text-[11px] font-medium", STATUS_CLASS[t.status])}>
                  {STATUS_LABEL[t.status]}
                </span>
              )}

              <span className="mt-1.5 flex items-center gap-2">
                <MemberAvatars people={t.members} max={3} />
                <span className="text-muted-foreground ml-auto flex items-center gap-1.5 text-[11px]">
                  {t.attachments.length > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Paperclip className="h-3 w-3" />
                      {t.attachments.length}
                    </span>
                  )}
                  {t.links.length > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Link2 className="h-3 w-3" />
                      {t.links.length}
                    </span>
                  )}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
