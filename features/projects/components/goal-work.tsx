"use client"

import * as React from "react"
import { CalendarPlus, ChevronRight, Package } from "lucide-react"

import { cn } from "@/lib/utils"
import { Link } from "@/components/tenant-link"
import { Button } from "@/components/ui/button"
import { DELIVERABLE_STATUS_LABELS } from "../lib/deliverable-lifecycle"
import type { GoalPlanTeam } from "../lib/goal-plan"
import { projectHref } from "../lib/project-href"
import { fmtDate } from "./goal-status"

/** What each team owes towards a goal and how much is made; opens to the items. */
export function GoalWork({
  projectId,
  plan,
  compact,
  needsPlan,
  onPlan,
  className,
}: {
  /** Each item links to its deliverable's tasks on this project. */
  projectId: string
  plan: GoalPlanTeam[] | undefined
  compact?: boolean
  /** A numbered part with nothing planned says so - its owner can't move the number alone. */
  needsPlan?: boolean
  /** Shown to whoever may plan (the account manager). */
  onPlan?: () => void
  className?: string
}) {
  const [open, setOpen] = React.useState<Set<string>>(new Set())
  const teams = plan ?? []
  if (teams.length === 0 && !needsPlan) return null

  const toggle = (key: string) =>
    setOpen((cur) => {
      const next = new Set(cur)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className={cn("space-y-1", compact ? "pl-10 sm:pl-12" : "px-4 sm:px-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground flex items-center gap-1.5 text-[10px] tracking-widest uppercase">
          <Package className="h-3 w-3" /> Work
        </p>
        {onPlan && (
          <Button
            variant="ghost"
            className="text-muted-foreground h-6 px-2 text-[11px]"
            onClick={onPlan}
          >
            <CalendarPlus className="h-3 w-3" /> Plan work
          </Button>
        )}
      </div>
      {teams.length === 0 ? (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          No work planned for this part yet.
        </p>
      ) : (
        <ul className="divide-border/60 divide-y rounded-sm border">
          {teams.map((t) => {
            const key = t.teamId ?? "none"
            const isOpen = open.has(key)
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-expanded={isOpen}
                  className="hover:bg-muted/40 flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-2.5 py-1.5 text-left text-[11px]"
                >
                  <ChevronRight
                    className={cn(
                      "text-muted-foreground h-3 w-3 shrink-0 transition-transform",
                      isOpen && "rotate-90",
                    )}
                  />
                  <span className="min-w-20 font-semibold">{t.teamName}</span>
                  <span className="tabular-nums">
                    {t.made}
                    <span className="text-muted-foreground"> / {t.planned} made</span>
                  </span>
                  {t.overdue > 0 && (
                    <span className="text-destructive font-medium">{t.overdue} late</span>
                  )}
                  {t.unclaimed > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">
                      {t.unclaimed} unclaimed
                    </span>
                  )}
                </button>
                {isOpen && (
                  <ul className="bg-muted/20 space-y-0.5 px-2.5 pt-0.5 pb-1.5 pl-8">
                    {t.items.map((i) => (
                      <li
                        key={i.id}
                        className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]"
                      >
                        <span className="text-muted-foreground">{i.type}</span>
                        <Link
                          href={projectHref({ id: projectId }, "deliverables", {
                            deliverable: i.id,
                          })}
                          className="min-w-0 truncate hover:underline"
                          title="Open its tasks"
                        >
                          {i.title}
                        </Link>
                        <span className="tabular-nums">
                          {i.made}/{i.quantity}
                        </span>
                        <span className="text-muted-foreground">
                          {DELIVERABLE_STATUS_LABELS[i.status]}
                        </span>
                        {i.dueOn && (
                          <span
                            className={cn(
                              i.overdue ? "text-destructive font-medium" : "text-muted-foreground",
                            )}
                          >
                            due {fmtDate(i.dueOn)}
                          </span>
                        )}
                        <span className="text-muted-foreground/80">
                          {i.employeeName ?? "unclaimed"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
