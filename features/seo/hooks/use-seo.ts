"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import type {
  ScorecardView,
  SeoConfig,
  SeoOverview,
  SeoRollup,
  TechnicalAuditView,
  VitalsView,
  KeywordView,
  CompetitorAuditView,
  ContentBriefView,
  BacklinkSummaryView,
  MonitorView,
  SetupStateView,
  KeywordSuggestionView,
  CompetitorSuggestionView,
} from "../types"

const listKey = (projectId: string) => ["project-seo-sites", projectId]
const rollupKey = (projectId: string) => ["project-seo-rollup", projectId]
const overviewKey = (propertyId: string) => ["seo-overview", propertyId]

/** Invalidate everything that could have changed after a write or a sync. */
function invalidateAll(qc: ReturnType<typeof useQueryClient>, projectId: string) {
  qc.invalidateQueries({ queryKey: listKey(projectId) })
  qc.invalidateQueries({ queryKey: rollupKey(projectId) })
  qc.invalidateQueries({ queryKey: ["seo-overview"] })
}

export interface SeoSitesResponse {
  properties: SeoConfig[]
  gscConfigured: boolean
  serviceAccount: string | null
}

/** Every site tracked under a project. Skips the fetch when no project is
 *  selected yet, so callers can pass a possibly-empty id. */
export function useSeoSites(projectId: string) {
  return useQuery({
    queryKey: listKey(projectId),
    queryFn: () =>
      apiFetch<{ data: SeoSitesResponse }>(`/api/projects/${projectId}/seo`).then((r) => r.data),
    enabled: !!projectId,
    staleTime: 60_000,
  })
}

/** Combined numbers across every site on the project. */
export function useSeoRollup(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: rollupKey(projectId),
    queryFn: () =>
      apiFetch<{ data: SeoRollup }>(`/api/projects/${projectId}/seo/rollup`).then((r) => r.data),
    enabled,
    staleTime: 60_000,
  })
}

/** Which window the report should cover. Omit for the latest single week. */
export interface SeoPeriod {
  /** ISO date (YYYY-MM-DD): show the window ending on or before this date. */
  end?: string | null
  /** How many stored weeks to combine. 1 is a single week. */
  weeks?: number
}

/** The full report for one site, for a chosen period. */
export function useSeoOverview(
  projectId: string,
  propertyId: string | null,
  period: SeoPeriod = {},
) {
  const weeks = period.weeks ?? 1
  const end = period.end ?? null
  const qs = new URLSearchParams()
  if (end) qs.set("end", end)
  if (weeks !== 1) qs.set("weeks", String(weeks))
  const suffix = qs.toString() ? `?${qs}` : ""

  return useQuery({
    // The period is part of the key, so switching weeks refetches instead of
    // showing the previous window's numbers under a new label.
    queryKey: [...overviewKey(propertyId ?? ""), end, weeks],
    queryFn: () =>
      apiFetch<{ data: SeoOverview }>(
        `/api/projects/${projectId}/seo/${propertyId}/overview${suffix}`,
      ).then((r) => r.data),
    enabled: !!propertyId,
    staleTime: 60_000,
    // Keeps the table populated while a new period loads, so the layout does not
    // collapse to a skeleton on every change.
    placeholderData: (prev) => prev,
  })
}

export interface SeoSiteInput {
  label: string
  domain: string
  siteUrl?: string | null
  gaPropertyId?: string | null
  moneyKeywords?: string[]
  moneyPages?: string[]
  competitors?: string[]
  targetClicks?: number | null
  targetPosition?: number | null
  isActive?: boolean
  isPrimary?: boolean
}

export function useCreateSeoSite(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SeoSiteInput) =>
      apiFetch<{ data: SeoConfig }>(`/api/projects/${projectId}/seo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).then((r) => r.data),
    onSuccess: (site) => {
      toast.success(`${site.label} added`)
      invalidateAll(qc, projectId)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add the site"),
  })
}

export function useUpdateSeoSite(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ propertyId, ...input }: SeoSiteInput & { propertyId: string }) =>
      apiFetch<{ data: SeoConfig }>(`/api/projects/${projectId}/seo/${propertyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success("Saved")
      invalidateAll(qc, projectId)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  })
}

export function useDeleteSeoSite(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (propertyId: string) =>
      apiFetch<{ data: { deleted: boolean } }>(`/api/projects/${projectId}/seo/${propertyId}`, {
        method: "DELETE",
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success("Site removed")
      invalidateAll(qc, projectId)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove the site"),
  })
}

/** Sync one site, optionally backfilling 8 weeks of history. */
export function useSyncSeoSite(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ propertyId, backfill }: { propertyId: string; backfill?: boolean }) =>
      apiFetch<{ data: { synced?: number; clicks?: number } }>(
        `/api/projects/${projectId}/seo/${propertyId}/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backfill: backfill ?? false }),
        },
      ).then((r) => r.data),
    onSuccess: (d) => {
      toast.success(
        d.synced
          ? `Synced ${d.synced} week${d.synced > 1 ? "s" : ""} of data`
          : "Search Console data synced",
      )
      invalidateAll(qc, projectId)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Sync failed"),
  })
}

/** Sync every active site on the project. */
export function useSyncAllSeo(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ data: { synced: number; failed: number } }>(
        `/api/projects/${projectId}/seo/sync`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      ).then((r) => r.data),
    onSuccess: (d) => {
      toast.success(
        d.failed
          ? `Synced ${d.synced} site${d.synced > 1 ? "s" : ""}, ${d.failed} failed`
          : `Synced ${d.synced} site${d.synced > 1 ? "s" : ""}`,
      )
      invalidateAll(qc, projectId)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Sync failed"),
  })
}

/** Search Console properties the service account can read (for the picker). */
export function useGscSites(enabled: boolean) {
  return useQuery({
    queryKey: ["gsc-sites"],
    queryFn: () =>
      apiFetch<{ data: { sites: { siteUrl: string; permissionLevel: string }[] } }>(
        "/api/seo/sites",
      ).then((r) => r.data),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  })
}

// --- phase 1: scorecard + Core Web Vitals -----------------------------------

export function useScorecard(projectId: string, propertyId: string | null) {
  return useQuery({
    queryKey: ["seo-scorecard", propertyId ?? ""],
    queryFn: () =>
      apiFetch<{ data: ScorecardView | null }>(
        `/api/projects/${projectId}/seo/${propertyId}/scorecard`,
      ).then((r) => r.data),
    enabled: !!propertyId,
    staleTime: 60_000,
  })
}

export function useRebuildScorecard(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (propertyId: string) =>
      apiFetch<{ data: unknown }>(`/api/projects/${projectId}/seo/${propertyId}/scorecard`, {
        method: "POST",
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success("Scorecard recalculated")
      qc.invalidateQueries({ queryKey: ["seo-scorecard"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not recalculate"),
  })
}

export function useVitals(projectId: string, propertyId: string | null) {
  return useQuery({
    queryKey: ["seo-vitals", propertyId ?? ""],
    queryFn: () =>
      apiFetch<{ data: VitalsView[] }>(`/api/projects/${projectId}/seo/${propertyId}/vitals`).then(
        (r) => r.data,
      ),
    enabled: !!propertyId,
    staleTime: 60_000,
  })
}

/** Measure Core Web Vitals now (slow: a real Lighthouse run per page). */
export function useRunVitals(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (propertyId: string) =>
      apiFetch<{ data: { vitals: { checked: number; failed: number; green: number } } }>(
        `/api/projects/${projectId}/seo/${propertyId}/vitals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ traffic: true }),
        },
      ).then((r) => r.data),
    onSuccess: (d) => {
      const v = d.vitals
      toast.success(
        `Checked ${v.checked} page${v.checked === 1 ? "" : "s"} · ${v.green} passing` +
          (v.failed ? ` · ${v.failed} unreachable` : ""),
      )
      qc.invalidateQueries({ queryKey: ["seo-vitals"] })
      qc.invalidateQueries({ queryKey: ["seo-scorecard"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Vitals check failed"),
  })
}

// --- phase 2: technical audit -----------------------------------------------

export function useTechnicalAudit(projectId: string, propertyId: string | null) {
  return useQuery({
    queryKey: ["seo-technical", propertyId ?? ""],
    queryFn: () =>
      apiFetch<{ data: TechnicalAuditView | null }>(
        `/api/projects/${projectId}/seo/${propertyId}/technical`,
      ).then((r) => r.data),
    enabled: !!propertyId,
    staleTime: 60_000,
  })
}

/** Run a fresh crawl now (slow: fetches each money page live). */
export function useRunTechnicalAudit(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (propertyId: string) =>
      apiFetch<{ data: { pagesChecked: number; criticalCount: number; warningCount: number } }>(
        `/api/projects/${projectId}/seo/${propertyId}/technical`,
        { method: "POST" },
      ).then((r) => r.data),
    onSuccess: (d) => {
      toast.success(
        `Audited ${d.pagesChecked} page${d.pagesChecked === 1 ? "" : "s"} · ${d.criticalCount} critical, ${d.warningCount} warnings`,
      )
      qc.invalidateQueries({ queryKey: ["seo-technical"] })
      qc.invalidateQueries({ queryKey: ["seo-scorecard"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Audit failed"),
  })
}

// --- phase 3: keyword backlog -----------------------------------------------

export function useKeywordBacklog(projectId: string, propertyId: string | null) {
  return useQuery({
    queryKey: ["seo-keywords", propertyId ?? ""],
    queryFn: () =>
      apiFetch<{ data: KeywordView[] }>(
        `/api/projects/${projectId}/seo/${propertyId}/keywords`,
      ).then((r) => r.data),
    enabled: !!propertyId,
    staleTime: 60_000,
  })
}

export function useGenerateBacklog(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (propertyId: string) =>
      apiFetch<{ data: { added: number; updated: number; total: number } }>(
        `/api/projects/${projectId}/seo/${propertyId}/keywords`,
        { method: "POST" },
      ).then((r) => r.data),
    onSuccess: (d) => {
      toast.success(`Backlog: ${d.added} new, ${d.updated} refreshed (${d.total} total)`)
      qc.invalidateQueries({ queryKey: ["seo-keywords"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not generate backlog"),
  })
}

/** Mine the latest competitor crawl for the phrases those sites target. */
export function useMineCompetitorKeywords(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (propertyId: string) =>
      apiFetch<{
        data: { added: number; updated: number; total: number; withDemandData: number }
      }>(`/api/projects/${projectId}/seo/${propertyId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: "competitors" }),
      }).then((r) => r.data),
    onSuccess: (d) => {
      toast.success(
        `${d.added} new keyword${d.added === 1 ? "" : "s"} from competitors` +
          (d.withDemandData ? `, ${d.withDemandData} you already get impressions for` : ""),
      )
      qc.invalidateQueries({ queryKey: ["seo-keywords"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not mine competitors"),
  })
}

export interface KeywordPatch {
  winnable?: boolean | null
  businessValue?: number
  intent?: string
  status?: string
  notes?: string | null
}

export function useUpdateKeyword(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      propertyId,
      keywordId,
      ...patch
    }: KeywordPatch & { propertyId: string; keywordId: string }) =>
      apiFetch<{ data: { ok: boolean } }>(
        `/api/projects/${projectId}/seo/${propertyId}/keywords/${keywordId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      ).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seo-keywords"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  })
}

// --- phase 4: competitor gap analysis ---------------------------------------

export function useCompetitorAudit(projectId: string, propertyId: string | null) {
  return useQuery({
    queryKey: ["seo-competitors", propertyId ?? ""],
    queryFn: () =>
      apiFetch<{ data: CompetitorAuditView | null }>(
        `/api/projects/${projectId}/seo/${propertyId}/competitors`,
      ).then((r) => r.data),
    enabled: !!propertyId,
    staleTime: 60_000,
  })
}

/** Crawl the configured competitors now and diff their topics against ours. */
export function useRunCompetitorGap(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (propertyId: string) =>
      apiFetch<{ data: { competitorsChecked: number; gapCount: number } }>(
        `/api/projects/${projectId}/seo/${propertyId}/competitors`,
        { method: "POST" },
      ).then((r) => r.data),
    onSuccess: (d) => {
      toast.success(
        `Checked ${d.competitorsChecked} competitor${d.competitorsChecked === 1 ? "" : "s"} · ${d.gapCount} content gap${d.gapCount === 1 ? "" : "s"} found`,
      )
      qc.invalidateQueries({ queryKey: ["seo-competitors"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Competitor analysis failed"),
  })
}

// --- phase 5: content brief + QA loop ---------------------------------------

export function useContentBriefs(projectId: string, propertyId: string | null) {
  return useQuery({
    queryKey: ["seo-content", propertyId ?? ""],
    queryFn: () =>
      apiFetch<{ data: ContentBriefView[] }>(
        `/api/projects/${projectId}/seo/${propertyId}/content`,
      ).then((r) => r.data),
    enabled: !!propertyId,
    staleTime: 60_000,
  })
}

export function useCreateBrief(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      propertyId,
      ...input
    }: {
      propertyId: string
      keywordId?: string
      targetQuery?: string
    }) =>
      apiFetch<{ data: ContentBriefView }>(`/api/projects/${projectId}/seo/${propertyId}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success("Brief created")
      qc.invalidateQueries({ queryKey: ["seo-content"] })
      qc.invalidateQueries({ queryKey: ["seo-keywords"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create the brief"),
  })
}

export interface BriefPatchInput {
  action?: "update" | "qa"
  url?: string
  status?: string
  outline?: string[]
  angle?: string | null
  notes?: string | null
  publishedUrl?: string | null
}

export function useUpdateBrief(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      propertyId,
      briefId,
      ...patch
    }: BriefPatchInput & { propertyId: string; briefId: string }) =>
      apiFetch<{ data: ContentBriefView }>(
        `/api/projects/${projectId}/seo/${propertyId}/content/${briefId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      ).then((r) => r.data),
    onSuccess: (_d, vars) => {
      if (vars.action === "qa") toast.success("QA checked")
      qc.invalidateQueries({ queryKey: ["seo-content"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update the brief"),
  })
}

export function useDeleteBrief(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ propertyId, briefId }: { propertyId: string; briefId: string }) =>
      apiFetch<{ data: { deleted: boolean } }>(
        `/api/projects/${projectId}/seo/${propertyId}/content/${briefId}`,
        { method: "DELETE" },
      ).then((r) => r.data),
    onSuccess: () => {
      toast.success("Brief removed")
      qc.invalidateQueries({ queryKey: ["seo-content"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove the brief"),
  })
}

// --- step 8: off-page / backlinks -------------------------------------------

export function useBacklinks(projectId: string, propertyId: string | null) {
  return useQuery({
    queryKey: ["seo-backlinks", propertyId ?? ""],
    queryFn: () =>
      apiFetch<{ data: BacklinkSummaryView }>(
        `/api/projects/${projectId}/seo/${propertyId}/backlinks`,
      ).then((r) => r.data),
    enabled: !!propertyId,
    staleTime: 60_000,
  })
}

export interface BacklinkImportInput {
  propertyId: string
  text: string
  source?: "AWT" | "GSC" | "MANUAL"
  fullSnapshot?: boolean
}

export function useImportBacklinks(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ propertyId, ...body }: BacklinkImportInput) =>
      apiFetch<{
        data: { added: number; refreshed: number; lost: number; referringDomains: number }
      }>(`/api/projects/${projectId}/seo/${propertyId}/backlinks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.data),
    onSuccess: (d) => {
      toast.success(
        `Imported: ${d.added} new, ${d.refreshed} refreshed${d.lost ? `, ${d.lost} lost` : ""} · ${d.referringDomains} referring domains`,
      )
      qc.invalidateQueries({ queryKey: ["seo-backlinks"] })
      qc.invalidateQueries({ queryKey: ["seo-scorecard"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import failed"),
  })
}

// --- step 9: daily accident monitor -----------------------------------------

export function useMonitor(projectId: string, propertyId: string | null) {
  return useQuery({
    queryKey: ["seo-monitor", propertyId ?? ""],
    queryFn: () =>
      apiFetch<{ data: MonitorView | null }>(
        `/api/projects/${projectId}/seo/${propertyId}/monitor`,
      ).then((r) => r.data),
    enabled: !!propertyId,
    staleTime: 60_000,
  })
}

export function useRunMonitor(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (propertyId: string) =>
      apiFetch<{ data: MonitorView }>(`/api/projects/${projectId}/seo/${propertyId}/monitor`, {
        method: "POST",
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seo-monitor"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Monitor check failed"),
  })
}

// --- guided setup ------------------------------------------------------------

/** The step-by-step readiness checklist for a site. */
export function useSeoSetup(projectId: string, propertyId: string | null) {
  return useQuery({
    queryKey: ["seo-setup", propertyId ?? ""],
    queryFn: () =>
      apiFetch<{ data: SetupStateView | null }>(
        `/api/projects/${projectId}/seo/${propertyId}/setup`,
      ).then((r) => r.data),
    enabled: !!propertyId,
    staleTime: 30_000,
  })
}

// --- AI assistance -----------------------------------------------------------

interface AiResponse {
  keywords?: KeywordSuggestionView[]
  competitors?: CompetitorSuggestionView[]
  text?: string
}

/** Ask the AI for keyword / competitor suggestions or a plain-language read-out.
 *  Suggestions are never auto-saved - the caller shows them for human approval. */
export function useSeoAi(projectId: string) {
  return useMutation({
    mutationFn: ({
      propertyId,
      task,
    }: {
      propertyId: string
      task: "keywords" | "competitors" | "explain"
    }) =>
      apiFetch<{ data: AiResponse }>(`/api/projects/${projectId}/seo/${propertyId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      }).then((r) => r.data),
    onError: (e) => toast.error(e instanceof Error ? e.message : "AI request failed"),
  })
}
