"use client"

import { useState } from "react"
import { Check, ChevronDown, ChevronRight, Download, FileText, Plus, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { cn } from "@/lib/utils"
import type { ContentBriefView } from "../types"
import { useContentBriefs, useCreateBrief, useDeleteBrief, useUpdateBrief } from "../hooks/use-seo"
import { exportBriefs } from "../lib/seo-export"

// =============================================================================
// The content loop (plan step 7): brief -> write -> QA -> publish -> 30-day
// check. The team writes the page; this panel gives the outline, runs the
// on-page QA gate against the live URL, and reports whether the query's Search
// Console position improved 30 days after publish.
// =============================================================================

const STATUS_LABEL: Record<string, string> = {
  BRIEF: "Brief",
  WRITING: "Writing",
  REVIEW: "In review",
  PUBLISHED: "Published",
  MEASURED: "Measured",
  PARKED: "Parked",
}
const STATUS_ORDER = ["BRIEF", "WRITING", "REVIEW", "PUBLISHED", "MEASURED", "PARKED"]

const OUTCOME_STYLE: Record<string, string> = {
  WON: "bg-emerald-500/15 text-emerald-600",
  FLAT: "bg-amber-500/15 text-amber-600",
  LOST: "bg-red-500/15 text-red-600",
}

export function ContentBriefPanel({
  projectId,
  propertyId,
  siteLabel = "site",
  canManage,
}: {
  projectId: string
  propertyId: string | null
  siteLabel?: string
  canManage: boolean
}) {
  const { data: briefs, isLoading } = useContentBriefs(projectId, propertyId)
  const create = useCreateBrief(projectId)
  const [query, setQuery] = useState("")

  if (isLoading) return <ListSkeleton rows={4} height="h-24" />

  const submit = () => {
    const q = query.trim()
    if (!q || !propertyId) return
    create.mutate({ propertyId, targetQuery: q }, { onSuccess: () => setQuery("") })
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Target query for a new page, e.g. “best crm for startups”"
              className="h-9 min-w-[240px] flex-1"
            />
            <Button size="sm" onClick={submit} disabled={create.isPending || !query.trim()}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New brief
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportBriefs(briefs ?? [], siteLabel)}
              disabled={(briefs?.length ?? 0) === 0}
              title={(briefs?.length ?? 0) === 0 ? "Nothing to export yet" : "Download as CSV"}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
          </CardContent>
        </Card>
      )}

      {(briefs?.length ?? 0) === 0 ? (
        <EmptyState
          icon={FileText}
          title="No content briefs yet"
          description={
            canManage
              ? "Start a brief from a target query above (or from the Backlog tab). Each brief gives the writer an outline built from your real related queries, then QA-checks the page once it's live and measures its ranking 30 days later."
              : "A project manager needs to create the first brief."
          }
        />
      ) : (
        <div className="space-y-3">
          {briefs!.map((b) => (
            <BriefCard
              key={b.id}
              projectId={projectId}
              propertyId={propertyId!}
              brief={b}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BriefCard({
  projectId,
  propertyId,
  brief,
  canManage,
}: {
  projectId: string
  propertyId: string
  brief: ContentBriefView
  canManage: boolean
}) {
  const update = useUpdateBrief(projectId)
  const remove = useDeleteBrief(projectId)
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState(brief.publishedUrl ?? "")

  const runQa = () => {
    if (!url.trim()) return
    update.mutate({ propertyId, briefId: brief.id, action: "qa", url: url.trim() })
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* header row */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 items-center gap-1.5 text-left"
          >
            {open ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate font-medium" title={brief.targetQuery}>
              {brief.targetQuery}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {brief.intent}
            </Badge>
            {brief.reviewOutcome && (
              <span
                className={cn(
                  "rounded-[2px] px-1.5 py-0.5 text-[10px] font-medium",
                  OUTCOME_STYLE[brief.reviewOutcome],
                )}
              >
                {brief.reviewOutcome}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2">
            {canManage ? (
              <Select
                value={brief.status}
                onValueChange={(v) => update.mutate({ propertyId, briefId: brief.id, status: v })}
              >
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                {STATUS_LABEL[brief.status] ?? brief.status}
              </Badge>
            )}
            {canManage && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => remove.mutate({ propertyId, briefId: brief.id })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* measurement summary (always visible once measured) */}
        {(brief.baselinePosition !== null || brief.reviewPosition !== null) && (
          <p className="text-muted-foreground text-xs">
            Position at publish:{" "}
            <strong>
              {brief.baselinePosition ? brief.baselinePosition.toFixed(1) : "not ranking"}
            </strong>
            {brief.reviewPosition !== null && (
              <>
                {" "}
                → after 30 days:{" "}
                <strong>
                  {brief.reviewPosition ? brief.reviewPosition.toFixed(1) : "not ranking"}
                </strong>
              </>
            )}
            {brief.reviewAt && brief.reviewOutcome === null && (
              <> · review due {new Date(brief.reviewAt).toLocaleDateString("en-IN")}</>
            )}
          </p>
        )}

        {open && (
          <div className="space-y-3 border-t pt-3">
            {/* outline */}
            <div>
              <p className="mb-1 text-xs font-medium">Suggested outline</p>
              <ol className="text-muted-foreground list-decimal space-y-0.5 pl-5 text-sm">
                {brief.outline.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ol>
            </div>

            {/* QA gate */}
            {canManage && (
              <div>
                <p className="mb-1 text-xs font-medium">QA the published page</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://…/published-page"
                    className="h-8 min-w-[220px] flex-1 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={runQa}
                    disabled={update.isPending || !url.trim()}
                  >
                    Run QA
                  </Button>
                </div>
              </div>
            )}

            {brief.qa && (
              <div className="rounded-[2px] border p-3">
                <p className="mb-2 text-xs font-medium">
                  QA {brief.qa.pass ? "passed" : "failed"} · score {brief.qa.score}/100 ·{" "}
                  <span className="text-muted-foreground">
                    {new Date(brief.qa.checkedAt).toLocaleString("en-IN")}
                  </span>
                </p>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {brief.qa.checks.map((c) => (
                    <li key={c.id} className="flex items-start gap-1.5 text-xs">
                      {c.ok ? (
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      ) : (
                        <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                      )}
                      <span className={cn(!c.ok && "text-red-600")}>
                        {c.label}
                        <span className="text-muted-foreground"> - {c.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
