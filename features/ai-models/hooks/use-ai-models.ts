"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type {
  AiKeyCreateInput,
  AiKeyUpdateInput,
  AiProviderCreateInput,
  AiProviderUpdateInput,
} from "../schemas/ai-models.schema"
import type { AiKeyTest, AiProviderView } from "../types"

const KEY = ["ai-models"] as const
const BASE = "/api/admin/ai-models"

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

export function useAiProviders() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<{ data: AiProviderView[] }>(BASE).then((r) => r.data),
    staleTime: 15_000,
  })
}

export function useCreateAiProvider() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (input: AiProviderCreateInput) => apiFetch(BASE, json("POST", input)),
      invalidate: [[...KEY]],
      success: (_d, v) => `${v.label} added`,
    }),
  )
}

export function useUpdateAiProvider() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({ id, ...input }: AiProviderUpdateInput & { id: string }) =>
        apiFetch(`${BASE}/${id}`, json("PATCH", input)),
      invalidate: [[...KEY]],
    }),
  )
}

export function useDeleteAiProvider() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (id: string) => apiFetch(`${BASE}/${id}`, { method: "DELETE" }),
      invalidate: [[...KEY]],
      success: "Provider removed",
    }),
  )
}

export function useAddAiKey() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({ providerId, ...input }: AiKeyCreateInput & { providerId: string }) =>
        apiFetch(`${BASE}/${providerId}/keys`, json("POST", input)),
      invalidate: [[...KEY]],
      success: "Key added",
    }),
  )
}

export function useUpdateAiKey() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({
        providerId,
        keyId,
        ...input
      }: AiKeyUpdateInput & { providerId: string; keyId: string }) =>
        apiFetch(`${BASE}/${providerId}/keys/${keyId}`, json("PATCH", input)),
      invalidate: [[...KEY]],
    }),
  )
}

export function useDeleteAiKey() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({ providerId, keyId }: { providerId: string; keyId: string }) =>
        apiFetch(`${BASE}/${providerId}/keys/${keyId}`, { method: "DELETE" }),
      invalidate: [[...KEY]],
      success: "Key removed",
    }),
  )
}

/** No toast here: the card shows the result next to the key. */
export function useTestAiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ providerId, keyId }: { providerId: string; keyId: string }) =>
      apiFetch<{ data: AiKeyTest }>(`${BASE}/${providerId}/keys/${keyId}/test`, {
        method: "POST",
      }).then((r) => r.data),
    // The key's "last used / last error" line changed.
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
