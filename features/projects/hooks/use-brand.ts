"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { BrandAssetKind, ProjectBrandData } from "@/features/projects/brand"

// ─── Brand workspace ──────────────────────────────────────────────────────────

export function useProjectBrand(projectId: string) {
  return useQuery({
    queryKey: ["project-brand", projectId],
    enabled: !!projectId,
    queryFn: (): Promise<{ data: ProjectBrandData }> =>
      apiFetch(`/api/projects/${projectId}/brand`),
  })
}

export function useSaveProjectBrand(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (body: Partial<ProjectBrandData>) =>
        apiFetch(`/api/projects/${projectId}/brand`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [["project-brand", projectId]],
      success: "Saved",
    }),
  )
}

export function useUploadBrandAsset(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: BrandAssetKind }) => {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("kind", kind)
      const res = await fetch(`/api/projects/${projectId}/brand/assets`, {
        method: "POST",
        body: fd,
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Upload failed")
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-brand", projectId] })
      toast.success("File uploaded")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteBrandAsset(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (assetId: string) =>
        apiFetch(`/api/projects/${projectId}/brand/assets/${assetId}`, { method: "DELETE" }),
      invalidate: [["project-brand", projectId]],
      success: "File removed",
    }),
  )
}
