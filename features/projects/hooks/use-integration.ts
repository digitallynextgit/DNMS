"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import type { MetaDashboard } from "../server/meta-sync.service"
import type { ShopifyDashboard } from "../server/shopify-sync.service"

const key = (projectId: string) => ["project-integration", projectId]
const shopifyKey = (projectId: string) => ["project-shopify", projectId]

/** A rolling `days` count or an inclusive yyyy-MM-dd `from`/`to` span; omit for all data. */
export interface IntegrationRange {
  days?: number
  from?: string
  to?: string
}

function rangeQuery(range?: IntegrationRange): string {
  const { days, from, to } = range ?? {}
  // An explicit span wins over the rolling window, matching the server.
  const query = new URLSearchParams()
  if (from && to) {
    query.set("from", from)
    query.set("to", to)
  } else if (days) {
    query.set("days", String(days))
  }
  return query.toString()
}

export function useProjectIntegration(projectId: string, range?: IntegrationRange) {
  const qs = rangeQuery(range)

  return useQuery({
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

// --- Shopify ---

export function useShopifyIntegration(projectId: string, range?: IntegrationRange) {
  const qs = rangeQuery(range)

  return useQuery({
    queryKey: [...shopifyKey(projectId), qs || "all"],
    queryFn: () =>
      apiFetch<{ data: ShopifyDashboard }>(
        `/api/projects/${projectId}/integration/shopify${qs ? `?${qs}` : ""}`,
      ).then((r) => r.data),
    staleTime: 30_000,
    // The server re-syncs every 15 minutes; an open dashboard picks that up on its own.
    refetchInterval: 5 * 60_000,
    placeholderData: (prev) => prev, // keep previous data while a new range loads
  })
}

export interface ShopifyConnectInput {
  storeDomain: string
  accessToken: string
}

/** Fetch the decrypted token to pre-fill the Edit form (manager-only route). */
export async function fetchShopifyCredentials(
  projectId: string,
): Promise<ShopifyConnectInput | null> {
  const r = await apiFetch<{ data: ShopifyConnectInput | null }>(
    `/api/projects/${projectId}/integration/shopify/credentials`,
  )
  return r.data
}

export function useConnectShopify(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ShopifyConnectInput) =>
      apiFetch<{ data: { message: string } }>(`/api/projects/${projectId}/integration/shopify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).then((r) => r.data),
    onSuccess: (r) => {
      toast.success(r.message)
      qc.invalidateQueries({ queryKey: shopifyKey(projectId) })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not connect"),
  })
}

export function useSyncShopify(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ data: { message: string } }>(
        `/api/projects/${projectId}/integration/shopify/sync`,
        { method: "POST" },
      ).then((r) => r.data),
    onSuccess: (r) => {
      toast.success(r.message)
      qc.invalidateQueries({ queryKey: shopifyKey(projectId) })
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Sync failed")
      // The error is stored on the connection; show it.
      qc.invalidateQueries({ queryKey: shopifyKey(projectId) })
    },
  })
}

export function useDisconnectShopify(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ data: { message: string } }>(`/api/projects/${projectId}/integration/shopify`, {
        method: "DELETE",
      }).then((r) => r.data),
    onSuccess: (r) => {
      toast.success(r.message)
      qc.invalidateQueries({ queryKey: shopifyKey(projectId) })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Disconnect failed"),
  })
}
