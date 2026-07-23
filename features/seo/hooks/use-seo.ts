"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import type { ScorecardView, SeoConfig, SeoOverview, SeoRollup, VitalsView } from "../types"

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

/** The full report for one site. */
export function useSeoOverview(projectId: string, propertyId: string | null) {
  return useQuery({
    queryKey: overviewKey(propertyId ?? ""),
    queryFn: () =>
      apiFetch<{ data: SeoOverview }>(`/api/projects/${projectId}/seo/${propertyId}/overview`).then(
        (r) => r.data,
      ),
    enabled: !!propertyId,
    staleTime: 60_000,
  })
}

export interface SeoSiteInput {
  label: string
  domain: string
  siteUrl?: string | null
  gaPropertyId?: string | null
  moneyKeywords?: string[]
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
