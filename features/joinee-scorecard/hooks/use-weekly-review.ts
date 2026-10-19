"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { ReviewParam } from "../lib/weekly-review"
import type { DueWeeklyReview, WeeklyReviewResponse } from "../types"

const keyFor = (employeeId: string | null | undefined) => ["joinee-weekly-review", employeeId]
const DEFAULT_KEY = ["joinee-weekly-review-params"]
const DUE_KEY = ["joinee-weekly-review-due"]
// The "Waiting on you" badge counts due reviews too (hr-checklists owns the key).
const BADGE_KEY = ["clearances", "count"]

const json = (body: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

export function useWeeklyReview(employeeId: string | null | undefined) {
  return useQuery({
    queryKey: keyFor(employeeId),
    enabled: !!employeeId,
    queryFn: async () =>
      (
        await apiFetch<{ data: WeeklyReviewResponse }>(
          `/api/joinee-weekly-reviews?employeeId=${encodeURIComponent(employeeId ?? "")}`,
        )
      ).data,
  })
}

export function useStartWeeklyReview(employeeId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: () =>
        apiFetch("/api/joinee-weekly-reviews", { method: "POST", ...json({ employeeId }) }),
      invalidate: [keyFor(employeeId)],
      success: "Weekly review started",
    }),
  )
}

export function useDeleteWeeklyReview(employeeId: string, id: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: () => apiFetch(`/api/joinee-weekly-reviews/${id}`, { method: "DELETE" }),
      invalidate: [keyFor(employeeId), DUE_KEY, BADGE_KEY],
      success: "Weekly review deleted",
    }),
  )
}

/** One Friday's scores and comment, saved together from its dialog. */
export function useSaveWeek(employeeId: string, id: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({
        weekNumber,
        ...body
      }: {
        weekNumber: number
        scores: Record<string, number | null>
        comment: string | null
      }) =>
        apiFetch(`/api/joinee-weekly-reviews/${id}/weeks/${weekNumber}`, {
          method: "PATCH",
          ...json(body),
        }),
      invalidate: [keyFor(employeeId), DUE_KEY, BADGE_KEY],
      success: "Weekly review saved",
    }),
  )
}

export interface ParamInput {
  key: string | null
  label: string
  isActive: boolean
}

/** One Friday's parameters, for this joinee only. */
export function useUpdateWeekParams(employeeId: string, id: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({ weekNumber, items }: { weekNumber: number; items: ParamInput[] }) =>
        apiFetch(`/api/joinee-weekly-reviews/${id}/weeks/${weekNumber}/params`, {
          method: "PUT",
          ...json({ items }),
        }),
      invalidate: [keyFor(employeeId)],
      success: "Parameters saved for this Friday",
    }),
  )
}

/** The company default new reviews start with. */
export function useDefaultReviewParams(enabled = true) {
  return useQuery({
    queryKey: DEFAULT_KEY,
    enabled,
    queryFn: async () =>
      (await apiFetch<{ data: { params: ReviewParam[] } }>("/api/joinee-weekly-reviews/params"))
        .data.params,
  })
}

export function useUpdateDefaultReviewParams() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (items: ParamInput[]) =>
        apiFetch("/api/joinee-weekly-reviews/params", { method: "PUT", ...json({ items }) }),
      invalidate: [DEFAULT_KEY],
      success: "Default parameters saved",
    }),
  )
}

/** For "Waiting on you": the Fridays the signed-in reporting manager still has to fill in. */
export function useMyDueWeeklyReviews() {
  return useQuery({
    queryKey: DUE_KEY,
    queryFn: async () =>
      (await apiFetch<{ data: DueWeeklyReview[] }>("/api/joinee-weekly-reviews/due")).data,
    staleTime: 30_000,
  })
}
