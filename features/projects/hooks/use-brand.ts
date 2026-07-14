"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { ProjectBrandData, ContentEntry } from "@/features/projects/brand"

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
    mutationFn: async ({ file, kind }: { file: File; kind: "BRIEF" | "LOGO" }) => {
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

// ─── Content calendar ─────────────────────────────────────────────────────────

export function useContentCalendar(
  projectId: string,
  params: { month?: string; platform?: string },
) {
  const { month, platform } = params
  return useQuery({
    queryKey: ["content-calendar", projectId, month ?? "all", platform ?? "all"],
    enabled: !!projectId,
    queryFn: (): Promise<{ data: ContentEntry[] }> => {
      const qs = new URLSearchParams()
      if (month) qs.set("month", month)
      if (platform) qs.set("platform", platform)
      const q = qs.toString()
      return apiFetch(`/api/projects/${projectId}/content-calendar${q ? `?${q}` : ""}`)
    },
  })
}

type EntryBody = Partial<Omit<ContentEntry, "id">>

export function useCreateEntry(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (body: EntryBody) =>
        apiFetch(`/api/projects/${projectId}/content-calendar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [["content-calendar", projectId]],
      success: "Post added",
    }),
  )
}

export function useUpdateEntry(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({ id, ...body }: EntryBody & { id: string }) =>
        apiFetch(`/api/projects/${projectId}/content-calendar/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [["content-calendar", projectId]],
      success: "Post updated",
    }),
  )
}

export function useDeleteEntry(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (id: string) =>
        apiFetch(`/api/projects/${projectId}/content-calendar/${id}`, { method: "DELETE" }),
      invalidate: [["content-calendar", projectId]],
      success: "Post deleted",
    }),
  )
}

export function useImportCalendar(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/projects/${projectId}/content-calendar/import`, {
        method: "POST",
        body: fd,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || "Import failed")
      return body.data as { imported: number; sheets: string[] }
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["content-calendar", projectId] })
      toast.success(`Imported ${r.imported} posts`)
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
