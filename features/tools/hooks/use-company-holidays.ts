"use client"

import { useQueries, type UseQueryResult } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import type { Holiday } from "@/features/attendance"

type YearResponse = { data: Holiday[] }

export interface CompanyHolidays {
  holidays: Holiday[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  /** Years that loaded but have no holidays at all (HR hasn't set them up yet). */
  emptyYears: number[]
  loadedYears: number[]
  retry: () => void
}

// Module-level so it's referentially stable: TanStack then only re-runs it when
// a query result changes, and `holidays` keeps its identity between renders.
function combineResults(results: UseQueryResult<YearResponse>[]) {
  return {
    holidays: results.flatMap((r) => r.data?.data ?? []),
    isLoading: results.some((r) => r.isPending),
    isError: results.some((r) => r.isError),
    error: results.find((r) => r.error)?.error ?? null,
    perYear: results.map((r) => (r.isSuccess ? (r.data?.data?.length ?? 0) : null)),
    retry: () => {
      for (const r of results) if (r.isError) void r.refetch()
    },
  }
}

/** Same endpoint and cache key as the Calendar page's useHolidays, so an HR edit refreshes both. */
export function useCompanyHolidays(years: number[]): CompanyHolidays {
  const { perYear, ...rest } = useQueries({
    queries: years.map((year) => ({
      queryKey: ["attendance-holidays", year],
      queryFn: () => apiFetch<YearResponse>(`/api/attendance/holidays?year=${year}`),
      staleTime: 300_000,
    })),
    combine: combineResults,
  })
  return {
    ...rest,
    emptyYears: years.filter((_, i) => perYear[i] === 0),
    loadedYears: years.filter((_, i) => perYear[i] != null),
  }
}
