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
