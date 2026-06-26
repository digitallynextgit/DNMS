"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { SettingValue } from "@/features/settings/server/settings.service"

export type { SettingValue }

export function useSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async () =>
      (await apiFetch<{ data: { data: SettingValue[] } }>("/api/settings")).data.data,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: async (values: Record<string, string>) =>
        (
          await apiFetch<{ data: { updated: number } }>("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          })
        ).data,
      invalidate: [["app-settings"]],
      success: "Settings saved",
    }),
  )
}
