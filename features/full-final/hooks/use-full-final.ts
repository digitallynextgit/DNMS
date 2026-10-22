"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { CreateFullFinalInput, UpdateFullFinalInput } from "../schemas/fnf.schema"
import type { FullFinalRow } from "../types"

const KEY = ["exit-clearance", "full-final"] as const
const URL = "/api/exit-clearance/full-final"

export function useFullFinal(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiFetch<{ data: FullFinalRow[] }>(URL)).data,
    enabled,
    staleTime: 60_000,
  })
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

export function useCreateFullFinal() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (input: CreateFullFinalInput) => apiFetch(URL, json("POST", input)),
      invalidate: [KEY],
      success: "Added to Full & Final",
    }),
  )
}

export function useUpdateFullFinal() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({ id, input }: { id: string; input: UpdateFullFinalInput }) =>
        apiFetch(`${URL}/${id}`, json("PATCH", input)),
      invalidate: [KEY],
      success: "Saved",
    }),
  )
}

export function useDeleteFullFinal() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (id: string) => apiFetch(`${URL}/${id}`, json("DELETE")),
      invalidate: [KEY],
      success: "Removed",
    }),
  )
}
