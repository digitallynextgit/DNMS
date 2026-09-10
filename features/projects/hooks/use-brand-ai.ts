"use client"

import { useMutation } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import { toastError } from "@/lib/error-message"

export interface BrandSource {
  id: string
  fileName: string
  status: "read" | "skipped"
  chars: number
  reason?: string
}

export interface BrandAnalysis {
  brief: string
  recommendations: string[]
  gaps: string[]
  sources: BrandSource[]
}

/** Ask the server to read the chosen brief documents and draft a brief. */
export function useAnalyseBrandDocs(projectId: string) {
  return useMutation({
    mutationFn: (assetIds: string[]) =>
      apiFetch<{ data: BrandAnalysis }>(`/api/projects/${projectId}/brand/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds }),
      }).then((r) => r.data),
    onError: (error) => toastError(error, "Couldn't draft the brief"),
  })
}
