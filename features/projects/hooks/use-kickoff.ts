"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import type { KickoffView } from "@/features/projects/lib/kickoff-template"

export const kickoffQueryKey = (projectId: string) => ["project-kickoff", projectId] as const

export function useProjectKickoff(projectId: string, enabled = true) {
  return useQuery({
    queryKey: kickoffQueryKey(projectId),
    enabled: !!projectId && enabled,
    queryFn: (): Promise<{ data: KickoffView }> => apiFetch(`/api/projects/${projectId}/kickoff`),
  })
}

export function useSetKickoffItem(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, ...patch }: { key: string; isDone?: boolean; note?: string | null }) =>
      apiFetch<{ data: KickoffView }>(
        `/api/projects/${projectId}/kickoff/${encodeURIComponent(key)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      ),
    onSuccess: (res) => {
      qc.setQueryData(kickoffQueryKey(projectId), res)
      // The My Projects badge reads progress from the list.
      void qc.invalidateQueries({ queryKey: ["projects"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save"),
  })
}
