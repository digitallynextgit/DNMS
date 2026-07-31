"use client"

import { useState } from "react"
import {
  Download,
  ExternalLink,
  RefreshCw,
  Settings2,
  Sparkles,
  Swords,
  Target,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { cn } from "@/lib/utils"
import type { CompetitorAuditView, CompetitorGapView } from "../types"
import { useCompetitorAudit, useRunCompetitorGap, useSeoSites } from "../hooks/use-seo"
import { exportCompetitors } from "../lib/seo-export"
import { AiSuggestDialog } from "./ai-suggest-dialog"

// =============================================================================
// Competitor gap analysis (plan step 5). Crawls each configured competitor's
// pages and lists the topics they publish for and we don't - the raw content
// backlog. A human then incognito-checks each gap and keeps the winnable ones.
// =============================================================================

export function CompetitorPanel({
  projectId,
  propertyId,
  siteLabel = "site",
  canManage,
  onEditSite,
}: {
  projectId: string
  propertyId: string | null
  siteLabel?: string
  canManage: boolean
  onEditSite?: () => void
}) {
  const { data: audit, isLoading } = useCompetitorAudit(projectId, propertyId)
  const { data: sitesData } = useSeoSites(projectId)
  const run = useRunCompetitorGap(projectId)
  const [aiOpen, setAiOpen] = useState(false)

  if (isLoading) return <ListSkeleton />

  const site = sitesData?.properties.find((p) => p.id === propertyId) ?? null
  const competitors = site?.competitors ?? []
  const hasCompetitors = competitors.length > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {audit ? `Last run ${new Date(audit.createdAt).toLocaleString("en-IN")}` : "Not run yet"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => audit && exportCompetitors(audit, siteLabel)}
            disabled={!audit || audit.gaps.length === 0}
            title={audit?.gaps.length ? "Download gaps as CSV" : "Nothing to export yet"}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
          {canManage && (
            <Button
              size="sm"
              onClick={() => propertyId && run.mutate(propertyId)}
              disabled={run.isPending || !propertyId || !hasCompetitors}
              title={hasCompetitors ? "Crawl competitors now" : "Add competitors first"}
            >
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", run.isPending && "animate-spin")} />
              {run.isPending ? "Crawling…" : "Run analysis"}
            </Button>
          )}
        </div>
      </div>

      {/* Who we're comparing against - and how to change it, without hunting
          through the site-settings dialog. */}
      {canManage && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <span className="text-xs font-medium">Competitors:</span>
            {hasCompetitors ? (
              competitors.map((c) => (
                <Badge key={c} variant="outline" className="text-[11px]">
                  {c}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground text-xs">none set yet</span>
            )}
            <div className="ml-auto flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setAiOpen(true)}
              >
                <Sparkles className="mr-1 h-3 w-3" />
                Suggest with AI
              </Button>
              {onEditSite && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onEditSite}>
                  <Settings2 className="mr-1 h-3 w-3" />
                  Edit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!audit ? (
        <EmptyState
          icon={Swords}
          title={hasCompetitors ? "No competitor analysis yet" : "Add competitors to get started"}
          description={
            canManage
              ? hasCompetitors
                ? "Run the analysis to crawl these competitors, turn their page titles & headings into a topic map, and list what they cover and you don't."
                : "Add 3 to 5 competitor domains above (or let AI suggest them), then run the analysis to see which topics they cover and you don't."
              : "A project manager needs to add competitors and run the analysis."
          }
        />
      ) : (
        <GapReport audit={audit} />
      )}

      {aiOpen && propertyId && (
        <AiSuggestDialog
          projectId={projectId}
          propertyId={propertyId}
          siteLabel={siteLabel}
          task="competitors"
          open={aiOpen}
          onOpenChange={setAiOpen}
          onEditSite={onEditSite}
        />
      )}
    </div>
  )
}

function GapReport({ audit }: { audit: CompetitorAuditView }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Competitors checked" value={audit.competitorsChecked} />
        <Stat label="Our pages compared" value={audit.ourPagesChecked} />
        <Stat
          label="Content gaps"
          value={audit.gapCount}
          tone={audit.gapCount > 0 ? "accent" : "muted"}
        />
      </div>

      {audit.competitors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {audit.competitors.map((c) => (
            <Badge key={c.domain} variant="outline" className="text-[11px]">
              {c.domain} · {c.pagesCrawled} page{c.pagesCrawled === 1 ? "" : "s"}
              {!c.ok && <span className="ml-1 text-red-600">unreachable</span>}
            </Badge>
          ))}
        </div>
      )}

      {audit.gaps.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm">
            <p className="font-medium">No obvious gaps found</p>
            <p className="text-muted-foreground text-xs">
              The crawled competitor topics are already covered by your pages and Search Console
              queries. Widen the competitor list or add more money pages for a deeper comparison.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="border-border border-b px-4 py-3">
              <p className="text-sm font-medium">Content gaps</p>
              <p className="text-muted-foreground text-xs">
                Topics competitors publish for that you don't. Incognito-search each - keep the ones
                where forums, Quora or small sites rank (winnable); park the ones owned by big
                brands.
              </p>
            </div>
            <div className="divide-border/60 divide-y">
              {audit.gaps.map((g, i) => (
                <GapRow key={`${g.topic}-${i}`} gap={g} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function GapRow({ gap }: { gap: CompetitorGapView }) {
  const search = `https://www.google.com/search?q=${encodeURIComponent(gap.topic)}`
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={gap.topic}>
          {gap.topic}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {gap.competitor}
          {gap.sampleTitle && gap.sampleTitle !== gap.topic ? ` · ${gap.sampleTitle}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={search}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
          title="Check the SERP (is it winnable?)"
        >
          <Target className="h-3.5 w-3.5" /> SERP
        </a>
        <a
          href={gap.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
          title="Their page"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Source
        </a>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "accent" | "muted"
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={cn(
            "text-2xl font-semibold",
            tone === "accent" && "text-primary",
            tone === "muted" && "text-muted-foreground",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
