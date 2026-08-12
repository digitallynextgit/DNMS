"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import type { MetaDashboard } from "../server/meta-sync.service"

const key = (projectId: string) => ["project-integration", projectId]

/**
 * Which metrics window to load: a rolling `days` count, or an explicit
 * `from`/`to` span of inclusive "yyyy-MM-dd" days. Omit everything for all data.
 */
export interface IntegrationRange {
  days?: number
  from?: string
  to?: string
}

/** `range` limits the metrics window (undefined = all synced data). */
export function useProjectIntegration(projectId: string, range?: IntegrationRange) {
  const { days, from, to } = range ?? {}
  // An explicit span wins over the rolling window, matching the server.
  const query = new URLSearchParams()
  if (from && to) {
    query.set("from", from)
    query.set("to", to)
  } else if (days) {
    query.set("days", String(days))
  }
  const qs = query.toString()

  return useQuery({
    // The querystring IS the cache key: two different ranges must not share an
    // entry, and it changes exactly when the request does.
    queryKey: [...key(projectId), qs || "all"],
    queryFn: () =>
      apiFetch<{ data: MetaDashboard }>(
        `/api/projects/${projectId}/integration${qs ? `?${qs}` : ""}`,
      ).then((r) => r.data),
    staleTime: 30_000,
    placeholderData: (prev) => prev, // keep previous data while a new range loads
  })
}

export interface MetaConnectInput {
  appId: string
  appSecret: string
  accessToken: string
  adAccountId: string
}

/** Fetch the decrypted credentials to pre-fill the Edit form (manager-only route). */
export async function fetchMetaCredentials(projectId: string): Promise<MetaConnectInput | null> {
  const r = await apiFetch<{ data: MetaConnectInput | null }>(
    `/api/projects/${projectId}/integration/credentials`,
  )
  return r.data
}

export function useConnectMeta(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MetaConnectInput) =>
      apiFetch<{ data: { message: string } }>(`/api/projects/${projectId}/integration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).then((r) => r.data),
    onSuccess: (r) => {
      toast.success(r.message)
      qc.invalidateQueries({ queryKey: key(projectId) })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not connect"),
  })
}

export function useSyncMeta(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (lookbackDays?: number) =>
      apiFetch<{ data: { message: string } }>(`/api/projects/${projectId}/integration/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookbackDays }),
      }).then((r) => r.data),
    onSuccess: (r) => {
      toast.success(r.message)
      qc.invalidateQueries({ queryKey: key(projectId) })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Sync failed"),
  })
}

export function useDisconnectMeta(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ data: { message: string } }>(`/api/projects/${projectId}/integration`, {
        method: "DELETE",
      }).then((r) => r.data),
    onSuccess: (r) => {
      toast.success(r.message)
      qc.invalidateQueries({ queryKey: key(projectId) })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Disconnect failed"),
  })
}
