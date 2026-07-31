"use client"

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSearch,
  Info,
  RefreshCw,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"
import type { TechnicalAuditView, TechnicalIssue, TechnicalPageAudit } from "../types"
import { useRunTechnicalAudit, useTechnicalAudit } from "../hooks/use-seo"
import { exportTechnical } from "../lib/seo-export"

// =============================================================================
// The technical-audit tab (plan step 6): crawl results for a site's money pages
// plus sitemap/robots checks. Critical issues here feed the scorecard.
// =============================================================================

function IssuePill({ issue }: { issue: TechnicalIssue }) {
  const map = {
    critical: { cls: "text-red-600", Icon: XCircle },
    warning: { cls: "text-amber-600", Icon: AlertTriangle },
    info: { cls: "text-sky-600", Icon: Info },
  } as const
  const { cls, Icon } = map[issue.level]
  return (
    <li className="flex gap-2 text-xs">
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", cls)} />
      <span className="text-muted-foreground">{issue.detail}</span>
    </li>
  )
}

export function TechnicalPanel({
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
  const { data: audit, isLoading } = useTechnicalAudit(projectId, propertyId)
  const run = useRunTechnicalAudit(projectId)

  if (isLoading) return <ListSkeleton />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {audit
            ? `Last audited ${new Date(audit.createdAt).toLocaleString("en-IN")}`
            : "Not audited yet"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => audit && exportTechnical(audit, siteLabel)}
            disabled={!audit}
            title={audit ? "Download as CSV" : "Run an audit first"}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
          {canManage && (
            <Button
              size="sm"
              onClick={() => propertyId && run.mutate(propertyId)}
              disabled={run.isPending || !propertyId}
            >
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", run.isPending && "animate-spin")} />
              {run.isPending ? "Crawling…" : "Run audit"}
            </Button>
          )}
        </div>
      </div>

      {!audit ? (
        <EmptyState
          icon={FileSearch}
          title="No technical audit yet"
          description={
            canManage
              ? "Run an audit to crawl this site's money pages and check its sitemap & robots.txt. It also runs automatically every week."
              : "A project manager needs to run the first audit."
          }
        />
      ) : (
        <AuditReport audit={audit} />
      )}
    </div>
  )
}

function AuditReport({ audit }: { audit: TechnicalAuditView }) {
  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard
          label="Critical"
          value={audit.criticalCount}
          tone={audit.criticalCount > 0 ? "bad" : "good"}
        />
        <SummaryCard
          label="Warnings"
          value={audit.warningCount}
          tone={audit.warningCount > 0 ? "warn" : "good"}
        />
        <SummaryCard label="Pages checked" value={audit.pagesChecked} tone="neutral" />
        <SummaryCard
          label="Sitemap URLs"
          value={audit.sitemapUrls}
          tone={audit.sitemapOk ? "good" : "bad"}
        />
      </div>

      {/* Site-level checks */}
      <Card>
        <CardContent className="flex flex-wrap gap-4 p-4 text-sm">
          <CheckRow ok={audit.sitemapOk} label="sitemap.xml" />
          <CheckRow ok={audit.robotsOk} label="robots.txt" />
        </CardContent>
      </Card>

      {audit.siteIssues.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-medium">Site-level issues</p>
            <ul className="space-y-1.5">
              {audit.siteIssues.map((i, idx) => (
                <IssuePill key={idx} issue={i} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Per-page results */}
      <Card>
        <CardContent className="p-0">
          <div className="border-border border-b px-4 py-3">
            <p className="text-sm font-medium">Page audit</p>
            <p className="text-muted-foreground text-xs">
              Money pages (or top pages by clicks if none are set).
            </p>
          </div>
          <div className="divide-border/60 divide-y">
            {audit.pages.map((page) => (
              <PageRow key={page.url} page={page} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "good" | "bad" | "warn" | "neutral"
}) {
  const cls = {
    good: "text-emerald-600",
    bad: "text-red-600",
    warn: "text-amber-600",
    neutral: "text-foreground",
  }[tone]
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={cn("text-2xl font-semibold", cls)}>{value}</p>
      </CardContent>
    </Card>
  )
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <XCircle className="h-4 w-4 text-red-600" />
      )}
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground text-xs">{ok ? "OK" : "issue"}</span>
    </span>
  )
}

function PageRow({ page }: { page: TechnicalPageAudit }) {
  const path = page.url.replace(/^https?:\/\/[^/]+/, "") || "/"
  const worst = page.issues.some((i) => i.level === "critical")
    ? "critical"
    : page.issues.some((i) => i.level === "warning")
      ? "warning"
      : "clean"
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {worst === "critical" ? (
          <XCircle className="h-4 w-4 shrink-0 text-red-600" />
        ) : worst === "warning" ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        )}
        <a
          href={page.url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-sm font-medium hover:underline"
          title={page.url}
        >
          {path}
        </a>
        <Badge variant="outline" className="text-[10px]">
          HTTP {page.status || "-"}
        </Badge>
        {page.noindex && (
          <Badge variant="outline" className="border-red-500/40 text-[10px] text-red-600">
            noindex
          </Badge>
        )}
        {page.schemaTypes.length > 0 && (
          <Badge variant="outline" className="text-[10px]">
            schema: {page.schemaTypes.slice(0, 3).join(", ")}
          </Badge>
        )}
      </div>

      {/* quick facts */}
      <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-4 gap-y-1 pl-6 text-[11px]">
        <span>Title: {page.titleLength || 0} chars</span>
        <span>H1: {page.h1Count}</span>
        <span>Canonical: {page.canonical ? "yes" : "no"}</span>
        <span>Schema: {page.schemaTypes.length}</span>
        <span>Alt-missing: {page.imagesMissingAlt}</span>
        <span>Internal links: {page.internalLinks}</span>
      </div>

      {page.issues.length > 0 && (
        <ul className="mt-2 space-y-1 pl-6">
          {page.issues.map((i, idx) => (
            <IssuePill key={idx} issue={i} />
          ))}
        </ul>
      )}
    </div>
  )
}
