"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { ScoreKey } from "../lib/scorecard"
import type { ScorecardResponse } from "../types"

const keyFor = (employeeId: string | null | undefined) => ["joinee-scorecard", employeeId]

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
      field: ScoreKey
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
              d.dayNumber === dayNumber ? { ...d, [field]: value } : d,
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
