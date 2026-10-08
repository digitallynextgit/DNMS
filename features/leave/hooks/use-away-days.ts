"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import type { AwayDay } from "../server/day-status.queries"

export type { AwayDay }

/** Days the employee is away (leave, half days, holidays - never WFH), for the task sheet. */
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

/** The same for a whole team in one request; ids are sorted so the same team in any order
 *  shares a cache entry. */
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
