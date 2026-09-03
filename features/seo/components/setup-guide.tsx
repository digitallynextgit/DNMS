"use client"

import { useState } from "react"
import { ArrowRight, Check, Lock, Settings2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CardGridSkeleton } from "@/components/shared/loading-skeleton"
import { cn } from "@/lib/utils"
import type { SetupAction, SetupField, SetupStepView } from "../types"
import {
  useGenerateBacklog,
  useRebuildScorecard,
  useRunCompetitorGap,
  useRunTechnicalAudit,
  useRunVitals,
  useSeoSetup,
  useSyncSeoSite,
} from "../hooks/use-seo"
import { AiSuggestDialog } from "./ai-suggest-dialog"

// =============================================================================
// The guided setup flow. The SEO module spans ten plan steps, and an operator
// landing on it cold cannot tell what is configured, what is missing, or which
// gap costs the most - so this turns the whole thing into a numbered checklist
// where every row states what it unlocks and carries the button that does it.
//
// Steps that the AI can propose values for (money keywords, competitors) get a
// "Suggest with AI" affordance; the suggestions still go through human approval.
// =============================================================================

export function SetupGuide({
  projectId,
  propertyId,
  siteLabel,
  canManage,
  onEditSite,
  onGoToTab,
  compact = false,
}: {
  projectId: string
  propertyId: string | null
  siteLabel: string
  canManage: boolean
  /** Open one specific setting, so a step never opens a form full of unrelated fields. */
  onEditSite: (field?: SetupField) => void
  onGoToTab: (tab: string) => void
  compact?: boolean
}) {
  const { data: setup, isLoading } = useSeoSetup(projectId, propertyId)
  const [aiTask, setAiTask] = useState<"keywords" | "competitors" | null>(null)

  const sync = useSyncSeoSite(projectId)
  const backlog = useGenerateBacklog(projectId)
  const competitors = useRunCompetitorGap(projectId)
  const technical = useRunTechnicalAudit(projectId)
  const vitals = useRunVitals(projectId)
  const scorecard = useRebuildScorecard(projectId)

  if (isLoading) return compact ? null : <CardGridSkeleton count={6} />
  if (!setup || !propertyId) return null

  const busy =
    sync.isPending ||
    backlog.isPending ||
    competitors.isPending ||
    technical.isPending ||
    vitals.isPending ||
    scorecard.isPending

  /** Run the action a step needs, or route the user to where they can do it. */
  const runAction = (action: SetupAction, field?: SetupField) => {
    switch (action) {
      case "EDIT_SITE":
        return onEditSite(field)
      case "SYNC":
        return sync.mutate({ propertyId, backfill: true })
      case "KEYWORDS":
        return backlog.mutate(propertyId)
      case "COMPETITORS":
        return competitors.mutate(propertyId)
      case "TECHNICAL":
        return technical.mutate(propertyId)
      case "VITALS":
        return vitals.mutate(propertyId)
      case "SCORECARD":
        return scorecard.mutate(propertyId)
      case "BACKLINKS":
        return onGoToTab("links")
    }
  }

  const done = setup.percent === 100
  const nextStep = setup.steps.find((s) => s.id === setup.nextStepId) ?? null

  // Compact mode: a single progress strip with the one next action.
  if (compact) {
    if (done) return null
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          <div className="flex items-center gap-2">
            <Progress percent={setup.percent} />
            <div className="text-xs">
              <p className="font-medium">
                Setup {setup.completed}/{setup.total}
              </p>
              {nextStep && <p className="text-muted-foreground">Next: {nextStep.title}</p>}
            </div>
          </div>
          {setup.lockedPoints > 0 && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Lock className="h-3 w-3" />
              {setup.lockedPoints} scorecard points locked
            </Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 text-xs"
            onClick={() => onGoToTab("start")}
          >
            Continue setup <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <Card className="overflow-hidden">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <Progress percent={setup.percent} size={64} />
          <div className="min-w-55 flex-1">
            <p className="font-medium">
              {done ? "Setup complete" : `${setup.completed} of ${setup.total} steps done`}
            </p>
            <p className="text-muted-foreground text-xs">
              {done
                ? "Everything is connected. Reports refresh automatically each week."
                : nextStep
                  ? `Next: ${nextStep.title}, which ${nextStep.impact.toLowerCase()}.`
                  : "The required steps are done. The optional ones add more detail."}
            </p>
            {/* A bar as well as the dial, so progress reads at a glance on mobile. */}
            <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-sm">
              <div
                className={cn(
                  "h-full rounded-sm transition-all duration-500",
                  done ? "bg-emerald-500" : "bg-primary",
                )}
                style={{ width: `${setup.percent}%` }}
              />
            </div>
          </div>
          {setup.lockedPoints > 0 && (
            <div className="rounded-sm border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs">
              <p className="flex items-center gap-1.5 font-medium text-amber-600">
                <Lock className="h-3.5 w-3.5" />
                {setup.lockedPoints} of 100 scorecard points locked
              </p>
              <p className="text-muted-foreground">Finish the steps below to measure them.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* The steps, as a grid of cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {setup.steps.map((step, i) => (
          <StepCard
            key={step.id}
            index={i + 1}
            step={step}
            isNext={step.id === setup.nextStepId}
            canManage={canManage}
            busy={busy}
            onRun={() => runAction(step.action, step.field)}
            onAi={step.aiAssist ? () => setAiTask(step.aiAssist!) : undefined}
          />
        ))}
      </div>

      {aiTask && propertyId && (
        <AiSuggestDialog
          projectId={projectId}
          propertyId={propertyId}
          siteLabel={siteLabel}
          task={aiTask}
          open={!!aiTask}
          onOpenChange={(v) => !v && setAiTask(null)}
          onEditSite={onEditSite}
        />
      )}
    </div>
  )
}

/**
 * One step as a self-contained, clickable card. The whole card runs the step's
 * action, so there is no hunting for a small button. The inner "Suggest with AI"
 * button stops propagation, otherwise clicking it would also fire the card.
 *
 * It is a div rather than a button because it contains a button, and nesting
 * buttons is invalid HTML. role/tabIndex/onKeyDown restore keyboard behaviour.
 */
function StepCard({
  index,
  step,
  isNext,
  canManage,
  busy,
  onRun,
  onAi,
}: {
  index: number
  step: SetupStepView
  isNext: boolean
  canManage: boolean
  busy: boolean
  onRun: () => void
  onAi?: () => void
}) {
  const interactive = canManage && !busy

  return (
    <Card
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `${step.title}. ${ACTION_LABEL[step.action]}` : undefined}
      onClick={interactive ? onRun : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onRun()
              }
            }
          : undefined
      }
      className={cn(
        "group relative flex h-full flex-col overflow-hidden transition-all duration-150",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        interactive &&
          "hover:border-primary/50 cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
        step.done && "bg-muted/30",
        isNext && !step.done && "border-primary/60 bg-primary/5 shadow-sm",
        busy && "pointer-events-none opacity-60",
      )}
    >
      {/* Status stripe down the left edge. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          step.done ? "bg-emerald-500" : isNext ? "bg-primary" : "bg-border",
        )}
      />

      <CardContent className="flex flex-1 flex-col gap-2 p-4 pl-5">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-xs font-semibold",
              step.done
                ? "bg-emerald-500/15 text-emerald-600"
                : isNext
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {step.done ? <Check className="h-4 w-4" /> : index}
          </span>

          <div className="flex flex-wrap items-center justify-end gap-1">
            {isNext && !step.done && <Badge className="text-[10px]">start here</Badge>}
            {step.optional && (
              <Badge variant="outline" className="text-[10px]">
                optional
              </Badge>
            )}
            {step.done && (
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-[10px] text-emerald-600"
              >
                done
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-1">
          <p className="text-sm font-medium">{step.title}</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{step.description}</p>
        </div>

        {!step.done && (
          <p className="text-muted-foreground/80 flex items-start gap-1.5 text-[11px]">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" />
            {step.impact}
          </p>
        )}

        {canManage && (
          <div className="mt-1 flex items-center gap-1.5 border-t pt-2.5">
            {onAi && !step.done && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 flex-1 text-xs"
                // Without this the card's own click handler would fire too.
                onClick={(e) => {
                  e.stopPropagation()
                  onAi()
                }}
              >
                <Sparkles className="mr-1 h-3 w-3" />
                Suggest with AI
              </Button>
            )}
            <Button
              size="sm"
              variant={step.done ? "ghost" : isNext ? "default" : "outline"}
              className={cn("h-7 text-xs", !onAi || step.done ? "w-full" : "flex-1")}
              onClick={(e) => {
                e.stopPropagation()
                onRun()
              }}
              disabled={busy}
              tabIndex={-1}
            >
              {step.action === "EDIT_SITE" && !step.done && <Settings2 className="mr-1 h-3 w-3" />}
              {step.done ? "Redo" : ACTION_LABEL[step.action]}
              {!step.done && (
                <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const ACTION_LABEL: Record<SetupAction, string> = {
  EDIT_SITE: "Configure",
  SYNC: "Sync now",
  KEYWORDS: "Generate",
  COMPETITORS: "Run analysis",
  TECHNICAL: "Run audit",
  VITALS: "Measure",
  BACKLINKS: "Import",
  SCORECARD: "Generate",
}

/** Small circular progress dial. */
function Progress({ percent, size = 44 }: { percent: number; size?: number }) {
  const r = 16
  const c = 2 * Math.PI * r
  const dash = (Math.max(0, Math.min(100, percent)) / 100) * c
  return (
    <div className="relative shrink-0" style={{ height: size, width: size }}>
      <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
        <circle cx="20" cy="20" r={r} className="stroke-muted fill-none" strokeWidth="4" />
        <circle
          cx="20"
          cy="20"
          r={r}
          className={cn("fill-none", percent === 100 ? "stroke-emerald-500" : "stroke-primary")}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-semibold">{percent}%</span>
      </div>
    </div>
  )
}
