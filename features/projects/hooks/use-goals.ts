"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import type { ProjectGoalsSummary } from "../lib/goal-derivation"

/**
 * A project's goal tree.
 *
 * ONE HOOK FOR BOTH SURFACES on purpose. The Overview card and the Goals tab
 * want the same payload, and if each declared its own query key the page would
 * fetch it twice and - worse - the card could keep showing a goal the tab had
 * just marked done, because invalidating one key leaves the other alone.
 *
 * `includeInactive` is part of the key rather than a filter applied after the
 * fact: it changes what the SERVER returns, so two different responses must not
 * share a cache entry. Every mutation invalidates the `["project-goals", id]`
 * PREFIX, which covers both variants in one call.
 *
 * The response type comes from the derivation module rather than a hand-copied
 * mirror, so a field added to the summary server-side is visible here without
 * anyone re-typing it.
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
    // A project id is required to build the URL; without one the request is a
    // 404 waiting to happen.
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

/**
 * What a write returns: the stored ROW, not the tallied `GoalTarget` the tree
 * carries. The made/met figures come from the refetched goal tree - they are
 * derived from deliverables this write never touched, so echoing them back
 * here would be a second, staler source for the same number.
 */
export interface GoalTargetRow {
  id: string
  deliverableType: string
  quantity: number
  /** ISO, as JSON.stringify leaves a Date. */
  periodStart: string | null
  periodEnd: string | null
}

/**
 * Adding, changing and dropping what a goal promised.
 *
 * Every one of the three invalidates BOTH goal surfaces. `["project-goals"]`
 * is the tab and the Overview card; `["goals-portfolio"]` is the Progress page,
 * which computes its own roll-up from the same targets - so a target changed on
 * one project moves a number on a page the user may already have open. Cheaper
 * to refetch both than to explain why the two disagree.
 */
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
