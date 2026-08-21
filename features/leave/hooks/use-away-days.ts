"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import type { AwayDay } from "../server/day-status.queries"

export type { AwayDay }

/**
 * Days the given employee is away across a range - approved leave, half days and
 * holidays. Used by the weekly task sheet to say WHY a column is empty.
 *
 * Never includes WFH: that is a normal working day from a different desk, and
 * showing it as an absence would be wrong.
 */
export function useAwayDays(employeeId: string | undefined, from?: string, to?: string) {
  return useQuery({
    queryKey: ["away-days", employeeId, from, to],
    queryFn: async () =>
      (
        await apiFetch<{ data: AwayDay[] }>(
          `/api/leave/day-status?employeeId=${encodeURIComponent(employeeId!)}&from=${from}&to=${to}`,
        )
      ).data,
    enabled: !!employeeId && !!from && !!to,
    // Leave is approved days in advance, not minute to minute.
    staleTime: 5 * 60_000,
  })
}

/**
 * The same question for a whole team, in one request.
 *
 * The project sheet is a row per person, so asking per row would open a request
 * for every name on the board each time the week is stepped. The ids are sorted
 * into the query key as well as the URL, so the same team in a different order
 * is the same cache entry rather than a second fetch of identical data.
 */
export function useTeamAwayDays(employeeIds: string[], from?: string, to?: string) {
  const ids = [...new Set(employeeIds.filter(Boolean))].sort().join(",")
  return useQuery({
    queryKey: ["away-days", "team", ids, from, to],
    queryFn: async () =>
      (
        await apiFetch<{ data: Record<string, AwayDay[]> }>(
          `/api/leave/day-status?employeeIds=${encodeURIComponent(ids)}&from=${from}&to=${to}`,
        )
      ).data,
    enabled: !!ids && !!from && !!to,
    staleTime: 5 * 60_000,
  })
}
