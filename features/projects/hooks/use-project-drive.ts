"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import type { DriveFile } from "@/lib/google-drive"

export interface ProjectDriveData {
  configured: boolean
  folderId: string | null
  folderLink: string | null
  memberCount: number
  files: DriveFile[]
}

const key = (projectId: string) => ["project-drive", projectId]

export function useProjectDrive(projectId: string) {
  return useQuery({
    queryKey: key(projectId),
    queryFn: () =>
      apiFetch<{ data: ProjectDriveData }>(`/api/projects/${projectId}/drive`).then((r) => r.data),
    staleTime: 20_000,
  })
}

export function useUploadDriveFile(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append("file", file)
      return apiFetch<{ data: DriveFile }>(`/api/projects/${projectId}/drive`, {
        method: "POST",
        body: fd,
      }).then((r) => r.data)
    },
    // No per-file success toast: uploads are batched, so the caller reports one
    // summary instead of N toasts. Failures still toast individually - knowing
    // WHICH file failed, and why, is worth the noise.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(projectId) })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  })
}

export function useCreateDriveFile(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { kind: "doc" | "sheet"; name: string }) =>
      apiFetch<{ data: DriveFile }>(`/api/projects/${projectId}/drive/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).then((r) => r.data),
    onSuccess: (f) => {
      toast.success(`Created "${f.name}"`)
      qc.invalidateQueries({ queryKey: key(projectId) })
      if (f.webViewLink) window.open(f.webViewLink, "_blank")
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Create failed"),
  })
}

export function useDeleteDriveFile(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fileId: string) =>
      apiFetch(`/api/projects/${projectId}/drive/file`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      }),
    onSuccess: () => {
      toast.success("Moved to trash")
      qc.invalidateQueries({ queryKey: key(projectId) })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  })
}

export function useSyncDriveAccess(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ data: { message: string } }>(`/api/projects/${projectId}/drive/sync`, {
        method: "POST",
      }).then((r) => r.data),
    onSuccess: (r) => {
      toast.success(r.message)
      qc.invalidateQueries({ queryKey: key(projectId) })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Sync failed"),
  })
}
