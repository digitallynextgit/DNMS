"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import type {
  WebChecklistStatus,
  WebChecklistView,
} from "@/features/projects/lib/web-checklist-template"

export const webChecklistQueryKey = (projectId: string) =>
  ["project-web-checklist", projectId] as const

export function useProjectWebChecklist(projectId: string) {
  return useQuery({
    queryKey: webChecklistQueryKey(projectId),
    enabled: !!projectId,
    queryFn: (): Promise<{ data: WebChecklistView }> =>
      apiFetch(`/api/projects/${projectId}/web-checklist`),
  })
}

export function useSetWebChecklistItem(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      key,
      ...patch
    }: {
      key: string
      status?: WebChecklistStatus
      note?: string | null
    }) =>
      apiFetch<{ data: WebChecklistView }>(
        `/api/projects/${projectId}/web-checklist/${encodeURIComponent(key)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      ),
    onSuccess: (res) => qc.setQueryData(webChecklistQueryKey(projectId), res),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save"),
  })
}
