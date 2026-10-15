"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { ScorecardSide } from "../lib/scorecard"
import type { CriteriaResponse, ScorecardResponse } from "../types"

const keyFor = (employeeId: string | null | undefined) => ["joinee-scorecard", employeeId]
const CRITERIA_KEY = ["joinee-scorecard-criteria"]

export function useScorecard(employeeId: string | null | undefined) {
  return useQuery({
    queryKey: keyFor(employeeId),
    enabled: !!employeeId,
    queryFn: async () =>
      (
        await apiFetch<{ data: ScorecardResponse }>(
          `/api/joinee-scorecards?employeeId=${encodeURIComponent(employeeId ?? "")}`,
        )
      ).data,
  })
}

export function useStartScorecard(employeeId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (body: { hrSpocId?: string | null }) =>
        apiFetch("/api/joinee-scorecards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId, ...body }),
        }),
      invalidate: [keyFor(employeeId)],
      success: "15-day scorecard started",
    }),
  )
}

export function useUpdateScorecard(employeeId: string, id: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (body: {
        hrSpocId?: string | null
        managerObservations?: string | null
        hrObservations?: string | null
        recommendation?: string | null
      }) =>
        apiFetch(`/api/joinee-scorecards/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [keyFor(employeeId)],
      success: "Scorecard saved",
    }),
  )
}

export function useDeleteScorecard(employeeId: string, id: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: () => apiFetch(`/api/joinee-scorecards/${id}`, { method: "DELETE" }),
      invalidate: [keyFor(employeeId)],
      success: "Scorecard deleted",
    }),
  )
}

/** Optimistic with rollback: HR fills ninety of these and can't wait on each round trip. */
export function useSetDayScore(employeeId: string, id: string) {
  const qc = useQueryClient()
  const key = keyFor(employeeId)
  const mutationKey = ["joinee-scorecard-score", employeeId]
  return useMutation({
    mutationKey,
    mutationFn: ({
      dayNumber,
      field,
      value,
    }: {
      dayNumber: number
      /** A criterion key. */
      field: string
      value: number | null
    }) =>
      apiFetch(`/api/joinee-scorecards/${id}/days/${dayNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      }),
    onMutate: async ({ dayNumber, field, value }) => {
      await qc.cancelQueries({ queryKey: key })
      const before = qc.getQueryData<ScorecardResponse>(key)
      if (before?.scorecard) {
        qc.setQueryData<ScorecardResponse>(key, {
          ...before,
          scorecard: {
            ...before.scorecard,
            days: before.scorecard.days.map((d) =>
              d.dayNumber === dayNumber ? { ...d, scores: { ...d.scores, [field]: value } } : d,
            ),
          },
        })
      }
      return { before }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(key, ctx.before)
      toast.error(e instanceof Error ? e.message : "Couldn't save that score")
    },
    // Refetch only after the LAST pending save, or an older server value flashes over a newer click.
    onSettled: () => {
      if (qc.isMutating({ mutationKey }) === 1) qc.invalidateQueries({ queryKey: key })
    },
  })
}

/** Every criterion row, hidden ones included - for the editor. */
export function useScorecardCriteria(enabled = true) {
  return useQuery({
    queryKey: CRITERIA_KEY,
    enabled,
    queryFn: async () =>
      (await apiFetch<{ data: CriteriaResponse }>("/api/joinee-scorecards/criteria")).data,
  })
}

export interface CriterionInput {
  key: string | null
  side: ScorecardSide
  label: string
  isActive: boolean
}

/** Replaces the company's criteria list; every scorecard picks the change up. */
export function useUpdateCriteria() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (items: CriterionInput[]) =>
        apiFetch("/api/joinee-scorecards/criteria", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        }),
      invalidate: [CRITERIA_KEY, ["joinee-scorecard"]],
      success: "Criteria saved",
    }),
  )
}
