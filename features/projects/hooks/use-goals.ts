"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { toast } from "sonner"

import { apiFetch } from "@/lib/api-fetch"
import type { ProjectGoalsSummary } from "../lib/goal-derivation"

/**
 * One key for both the Overview card and the Goals tab, so they never disagree. `includeInactive`
 * and `month` are part of the key (they change the server response); mutations invalidate the prefix.
 */
export const goalsKey = (projectId: string, includeInactive = false, month: string | null = null) =>
  ["project-goals", projectId, includeInactive, month ?? "current"] as const

/** `month` ("2026-10") picks which edition of each recurring goal is shown; null = this month. */
export function useProjectGoals(
  projectId: string,
  includeInactive = false,
  month: string | null = null,
) {
  const qs = new URLSearchParams()
  if (includeInactive) qs.set("includeInactive", "1")
  if (month) qs.set("month", month)
  const query = qs.toString()
  return useQuery({
    queryKey: goalsKey(projectId, includeInactive, month),
    queryFn: () =>
      apiFetch<ProjectGoalsSummary>(`/api/projects/${projectId}/goals${query ? `?${query}` : ""}`),
    enabled: Boolean(projectId),
  })
}

/** Entering and removing actual numbers; the goal tree and the Progress page refetch. */
export function useGoalResultMutations(projectId: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["project-goals", projectId] })
    qc.invalidateQueries({ queryKey: ["goals-portfolio"] })
    qc.invalidateQueries({ queryKey: ["goal-series", projectId] })
  }
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't save that")

  const addResult = useMutation({
    mutationFn: ({
      goalId,
      ...body
    }: {
      goalId: string
      value: number
      recordedFor: string
      note?: string | null
    }) =>
      apiFetch(`/api/projects/${projectId}/goals/${goalId}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      invalidate()
      toast.success("Result saved")
    },
    onError: fail,
  })

  const removeResult = useMutation({
    mutationFn: ({ goalId, resultId }: { goalId: string; resultId: string }) =>
      apiFetch(`/api/projects/${projectId}/goals/${goalId}/results/${resultId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      invalidate()
      toast.success("Result removed")
    },
    onError: fail,
  })

  return { addResult, removeResult }
}

export interface SeriesMonth {
  month: string
  goalId: string
  targetValue: number | null
  actualValue: number | null
  progress: number
  status: string
  parts: {
    service: string | null
    title: string
    targetValue: number | null
    actualValue: number | null
  }[]
}

export interface SeriesHistory {
  id: string
  title: string
  metricLabel: string | null
  stoppedAt: string | null
  months: SeriesMonth[]
}

/** Every month of a repeating goal, for the growth chart. */
export function useGoalSeriesHistory(projectId: string, seriesId: string | null) {
  return useQuery({
    queryKey: ["goal-series", projectId, seriesId],
    queryFn: () =>
      apiFetch<{ data: SeriesHistory }>(`/api/projects/${projectId}/goal-series/${seriesId}`).then(
        (r) => r.data,
      ),
    enabled: Boolean(projectId && seriesId),
  })
}

/** Stop a repeating goal (its months stay), or start it again from this month. */
export function useSetSeriesStopped(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ seriesId, stopped }: { seriesId: string; stopped: boolean }) =>
      apiFetch(`/api/projects/${projectId}/goal-series/${seriesId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stopped }),
      }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["project-goals", projectId] })
      qc.invalidateQueries({ queryKey: ["goal-series", projectId] })
      toast.success(
        v.stopped ? "Stopped repeating - its months stay" : "Repeating every month again",
      )
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't change that"),
  })
}

/** What the add/edit form sends. Dates are yyyy-MM-dd, or null for "no bound". */
export interface GoalTargetBody {
  deliverableType?: string
  quantity?: number
  periodStart?: string | null
  periodEnd?: string | null
}

/** The stored row, not the tallied `GoalTarget`: made/met come from the refetched goal tree. */
export interface GoalTargetRow {
  id: string
  deliverableType: string
  quantity: number
  /** ISO, as JSON.stringify leaves a Date. */
  periodStart: string | null
  periodEnd: string | null
}

/** Target add/edit/remove; invalidates both the goal tree and the Progress page roll-up. */
export function useGoalTargetMutations(projectId: string) {
  const qc = useQueryClient()
  const json = { "Content-Type": "application/json" }
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["project-goals", projectId] })
    qc.invalidateQueries({ queryKey: ["goals-portfolio"] })
  }
  const base = (goalId: string) => `/api/projects/${projectId}/goals/${goalId}/targets`

  const addTarget = useMutation({
    mutationFn: ({ goalId, ...body }: { goalId: string } & GoalTargetBody) =>
      apiFetch<{ data: GoalTargetRow }>(base(goalId), {
        method: "POST",
        headers: json,
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  })

  const updateTarget = useMutation({
    mutationFn: ({
      goalId,
      targetId,
      ...body
    }: { goalId: string; targetId: string } & GoalTargetBody) =>
      apiFetch<{ data: GoalTargetRow }>(`${base(goalId)}/${targetId}`, {
        method: "PATCH",
        headers: json,
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  })

  const removeTarget = useMutation({
    mutationFn: ({ goalId, targetId }: { goalId: string; targetId: string }) =>
      apiFetch<{ data: { id: string } }>(`${base(goalId)}/${targetId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })

  return { addTarget, updateTarget, removeTarget }
}
