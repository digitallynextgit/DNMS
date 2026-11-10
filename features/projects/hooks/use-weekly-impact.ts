"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { WeeklyImpactInput } from "../schemas/weekly-impact.schema"
import type { WeeklyImpactNote } from "../server/weekly-impact.service"

/** One person's week (My Tasks) or one project's week (Tasks tab). */
export type WeeklyImpactScope = { employeeId: string } | { projectId: string }

export function useWeeklyImpact(week: string, scope: WeeklyImpactScope | null) {
  const params = new URLSearchParams({ week, ...(scope ?? {}) })
  return useQuery({
    queryKey: ["weekly-impact", week, scope],
    queryFn: async () =>
      (await apiFetch<{ data: WeeklyImpactNote[] }>(`/api/tasks/weekly-impact?${params}`)).data,
    enabled: !!scope,
    staleTime: 15_000,
  })
}

export function useSaveWeeklyImpact() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast<{ data: WeeklyImpactNote | null }, WeeklyImpactInput>(qc, {
      mutationFn: (body) =>
        apiFetch("/api/tasks/weekly-impact", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [["weekly-impact"]],
      success: (_d, v) => (v.note.trim() ? "Weekly impact saved" : "Weekly impact cleared"),
    }),
  )
}
