"use client"

import { useQuery } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import type { GoalsSummary } from "../components/goal-status"

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
 */
export const goalsKey = (projectId: string, includeInactive = false) =>
  ["project-goals", projectId, includeInactive] as const

export function useProjectGoals(projectId: string, includeInactive = false) {
  return useQuery({
    queryKey: goalsKey(projectId, includeInactive),
    queryFn: () =>
      apiFetch<GoalsSummary>(
        `/api/projects/${projectId}/goals${includeInactive ? "?includeInactive=1" : ""}`,
      ),
    // A project id is required to build the URL; without one the request is a
    // 404 waiting to happen.
    enabled: Boolean(projectId),
  })
}
