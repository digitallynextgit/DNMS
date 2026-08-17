"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import type { StorageOverview } from "../types"

export function useStorageOverview(accountId?: string) {
  return useQuery({
    // accountId in the key: two buckets are different result sets, not one
    // filtered, so they must not share a cache entry.
    queryKey: ["admin-storage", accountId ?? "default"],
    queryFn: () =>
      apiFetch<{ data: StorageOverview }>(
        `/api/admin/storage${accountId ? `?accountId=${accountId}` : ""}`,
      ).then((r) => r.data),
    staleTime: 30_000,
  })
}

export function useDeleteStorageObject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (key: string) =>
      apiFetch<{ data: { message: string } }>("/api/admin/storage/object", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      }).then((r) => r.data),
    onSuccess: (r) => {
      toast.success(r.message)
      qc.invalidateQueries({ queryKey: ["admin-storage"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  })
}

export function useDeleteOrphans() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ data: { deleted: number; message: string } }>("/api/admin/storage/object", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orphansOnly: true }),
      }).then((r) => r.data),
    onSuccess: (r) => {
      toast.success(r.message)
      qc.invalidateQueries({ queryKey: ["admin-storage"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Cleanup failed"),
  })
}
