"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"

export interface ConnectionRow {
  id: string
  app: string
  appId: string
  verifiedAs: string | null
  scope: string[]
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
  revokedReason: string | null
  callsLast30Days: number
  employee: { id: string; firstName: string; lastName: string; employeeNo: string } | null
}

const KEY = ["ai-connections"] as const

export function useAiConnections(scope: "mine" | "all", enabled = true) {
  return useQuery({
    queryKey: [...KEY, scope],
    enabled,
    queryFn: async () =>
      (await apiFetch<{ data: ConnectionRow[] }>(`/api/ai-connections?scope=${scope}`)).data,
  })
}

export function useDisconnectAiApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/ai-connections/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
