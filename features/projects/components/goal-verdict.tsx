"use client"

import * as React from "react"
import { ListChecks, Package, UserRound, Inbox, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { GoalVerdict, VerdictTone } from "../lib/goal-accountability"
import { useAiSuggest, useProjectAi } from "../hooks/use-project-ai"

const TONE_CHIP: Record<VerdictTone, string> = {
  good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  neutral: "border-border text-muted-foreground",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  bad: "border-destructive/30 bg-destructive/10 text-destructive",
}

/** The verdict as a small pill; it opens the reasons. */
export function VerdictChip({
  verdict,
  onClick,
  className,
}: {
  verdict: GoalVerdict
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={verdict.summary}
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap transition-opacity hover:opacity-80",
        TONE_CHIP[verdict.tone],
        className,
      )}
    >
      {verdict.label}
    </button>
  )
}

const ITEM_ICON = { deliverable: Package, task: ListChecks, requirement: Inbox } as const

function Reasons({ verdict }: { verdict: GoalVerdict }) {
  return (
    <div className="space-y-3">
      <p className="text-sm">{verdict.summary}</p>
      {verdict.responsible.length > 0 && (
        <div className="space-y-1">
          <p className="text-muted-foreground text-[11px] tracking-widest uppercase">
            Who answers for it
          </p>
          <ul className="space-y-1 text-xs">
            {verdict.responsible.map((r) => (
              <li key={r.who} className="flex items-start gap-2">
                <UserRound className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-medium">{r.who}</span>
                  <span className="text-muted-foreground"> - {r.why}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {verdict.items.length > 0 && (
        <div className="space-y-1">
          <p className="text-muted-foreground text-[11px] tracking-widest uppercase">Behind it</p>
          <ul className="divide-y rounded-sm border text-xs">
            {verdict.items.map((i) => {
              const Icon = ITEM_ICON[i.kind]
              return (
                <li key={`${i.kind}-${i.id}`} className="flex items-start gap-2 px-2.5 py-1.5">
                  <Icon className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="font-medium">{i.title}</span>
                    <span className="text-muted-foreground block text-[11px]">{i.detail}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Why a goal stands where it does: the verdict, who answers for it, and the items behind it. */
export function VerdictDialog({
  title,
  verdict,
  onClose,
  explain,
}: {
  title: string
  verdict: GoalVerdict | null
  onClose: () => void
  /** Offer an AI explanation of the verdict (it never changes it). */
  explain?: { projectId: string; goalId: string }
}) {
  const aiReady = useProjectAi(explain?.projectId ?? "")
  const ask = useAiSuggest(explain?.projectId ?? "", "explain_goal")
  const [text, setText] = React.useState<{ goalId: string; text: string } | null>(null)
  const shown = text && text.goalId === explain?.goalId ? text.text : null
  return (
    <Dialog open={verdict !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {verdict && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {title}
                <VerdictChip verdict={verdict} onClick={() => {}} className="pointer-events-none" />
              </DialogTitle>
              <DialogDescription>
                Worked out from the numbers, the plan and the work - the same rules for everyone.
              </DialogDescription>
            </DialogHeader>
            <Reasons verdict={verdict} />
            {explain && aiReady && (
              <div className="bg-muted/30 space-y-1.5 rounded-sm border p-2.5">
                {shown ? (
                  <p className="flex items-start gap-1.5 text-xs">
                    <Sparkles className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" /> {shown}
                  </p>
                ) : (
                  <Button
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    loading={ask.isPending}
                    onClick={() =>
                      ask.mutate(
                        { goalId: explain.goalId },
                        { onSuccess: (r) => setText({ goalId: explain.goalId, text: r.text }) },
                      )
                    }
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Explain in plain words
                  </Button>
                )}
              </div>
            )}
            {verdict.parts && verdict.parts.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-muted-foreground text-[11px] tracking-widest uppercase">
                  By part
                </p>
                {verdict.parts.map((p) => (
                  <div key={p.goalId} className="space-y-1.5 rounded-sm border p-2.5">
                    <p className="flex items-center gap-2 text-xs font-semibold">
                      {p.title}
                      <VerdictChip
                        verdict={p.verdict}
                        onClick={() => {}}
                        className="pointer-events-none"
                      />
                    </p>
                    <Reasons verdict={p.verdict} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
