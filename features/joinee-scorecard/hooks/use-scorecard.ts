"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { ScoreKey } from "../lib/scorecard"
import type { ScorecardResponse } from "../types"

const keyFor = (employeeId: string | null | undefined) => ["joinee-scorecard", employeeId]

/** An employee's 15-day scorecard (null when none was started) and whether you may edit it. */
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

/** Start a scorecard by hand for someone who joined before scorecards existed. */
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

/** HR SPOC, observations, recommendation. */
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

/**
 * Set or clear one score. Optimistic: the grid shows the new value at once and
 * rolls back (with a toast) if the save fails - HR fills ninety of these, and
 * waiting on a round trip for each would make the grid feel broken.
 */
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
    // Refetch only once the LAST pending score has settled: a refetch between
    // two quick clicks would briefly paint the server's older value over the
    // newer optimistic one.
    onSettled: () => {
      if (qc.isMutating({ mutationKey }) === 1) qc.invalidateQueries({ queryKey: key })
    },
  })
}
