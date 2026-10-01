"use client"

import { useQuery } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import type { WorkReportScopeData } from "../types"

/** Who the signed-in user may put in a work report (from the same resolver the download uses). */
export function useWorkReportScope() {
  return useQuery({
    queryKey: ["work-report-scope"],
    queryFn: async () =>
      (await apiFetch<{ data: WorkReportScopeData }>("/api/work-reports/scope")).data,
    staleTime: 5 * 60_000,
  })
}
