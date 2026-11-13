"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { CreateMetricInput, SaveEntriesInput, UpdateMetricInput } from "../schemas/metrics.schema"
import type { MetricsBoard } from "../types"

const base = (projectId: string) => `/api/projects/${projectId}/metrics`
const boardKey = (projectId: string, week: string | null) => ["project-metrics", projectId, week] as const
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

export function useMetricsBoard(projectId: string, week: string | null) {
  return useQuery({
    queryKey: boardKey(projectId, week),
    queryFn: async () =>
      (
        await apiFetch<{ data: MetricsBoard }>(
          `${base(projectId)}${week ? `?week=${encodeURIComponent(week)}` : ""}`,
        )
      ).data,
    enabled: Boolean(projectId),
    staleTime: 30_000,
  })
}

/** Every week's view shares the same rows, so one save refreshes them all. */
function invalidate(qc: ReturnType<typeof useQueryClient>, projectId: string) {
  return qc.invalidateQueries({ queryKey: ["project-metrics", projectId] })
}

export function useSaveEntries(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (input: SaveEntriesInput) =>
        apiFetch(`${base(projectId)}/entries`, json("PUT", input)),
      success: "Week saved",
      onSuccess: () => invalidate(qc, projectId),
    }),
  )
}

export function useCreateMetric(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (input: CreateMetricInput) => apiFetch(base(projectId), json("POST", input)),
      success: "Metric added",
      onSuccess: () => invalidate(qc, projectId),
    }),
  )
}

export function useUpdateMetric(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({ id, ...input }: UpdateMetricInput & { id: string }) =>
        apiFetch(`${base(projectId)}/${id}`, json("PATCH", input)),
      success: "Metric updated",
      onSuccess: () => invalidate(qc, projectId),
    }),
  )
}

export function useRemoveMetric(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (id: string) => apiFetch(`${base(projectId)}/${id}`, json("DELETE")),
      success: "Metric removed",
      onSuccess: () => invalidate(qc, projectId),
    }),
  )
}
