"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { FlagActionInput, RaiseFlagInput } from "../schemas/oyd.schema"
import type { OydFlagView, OydListResult, OydPerson } from "../types"

export const oydKeys = {
  all: ["oyd"] as const,
  flags: ["oyd", "flags"] as const,
  people: ["oyd", "people"] as const,
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

export function useOydFlags() {
  return useQuery({
    queryKey: oydKeys.flags,
    queryFn: async () => (await apiFetch<{ data: OydListResult }>("/api/oyd/flags")).data,
    staleTime: 30_000,
  })
}

export function useOydPeople(enabled: boolean) {
  return useQuery({
    queryKey: oydKeys.people,
    queryFn: async () => (await apiFetch<{ data: OydPerson[] }>("/api/oyd/people")).data,
    enabled,
    staleTime: 60_000,
  })
}

export function useRaiseFlag() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast<OydFlagView, RaiseFlagInput>(qc, {
      mutationFn: async (body) =>
        (await apiFetch<{ data: OydFlagView }>("/api/oyd/flags", json("POST", body))).data,
      invalidate: [oydKeys.flags],
      success: (flag) =>
        flag.status === "CONFIRMED"
          ? "Flag raised and mailed, with HR and their manager in Cc"
          : "Flag raised. HR or their Reporting Manager will confirm it.",
    }),
  )
}

const ACTION_TOAST: Record<FlagActionInput["action"], string> = {
  confirm: "Flag confirmed and mailed",
  reject: "Flag marked as not confirmed",
  remove: "Flag removed. It stays in the history.",
}

export function useFlagAction() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast<OydFlagView, { id: string; body: FlagActionInput }>(qc, {
      mutationFn: async ({ id, body }) =>
        (await apiFetch<{ data: OydFlagView }>(`/api/oyd/flags/${id}`, json("PATCH", body))).data,
      invalidate: [oydKeys.flags],
      success: (_d, { body }) => ACTION_TOAST[body.action],
    }),
  )
}
