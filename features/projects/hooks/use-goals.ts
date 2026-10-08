"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import type { ProjectGoalsSummary } from "../lib/goal-derivation"

/**
 * One key for both the Overview card and the Goals tab, so they never disagree. `includeInactive`
 * is part of the key (it changes the server response); mutations invalidate the prefix.
 */
export const goalsKey = (projectId: string, includeInactive = false) =>
  ["project-goals", projectId, includeInactive] as const

export function useProjectGoals(projectId: string, includeInactive = false) {
  return useQuery({
    queryKey: goalsKey(projectId, includeInactive),
    queryFn: () =>
      apiFetch<ProjectGoalsSummary>(
        `/api/projects/${projectId}/goals${includeInactive ? "?includeInactive=1" : ""}`,
      ),
    enabled: Boolean(projectId),
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
