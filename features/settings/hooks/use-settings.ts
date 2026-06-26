"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getSettings,
  updateSettings,
  type SettingValue,
} from "@/features/settings/server/settings.actions"
import { unwrap } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"

export type { SettingValue }

export function useSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => (unwrap(await getSettings()) as { data: SettingValue[] }).data,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: async (values: Record<string, string>) => unwrap(await updateSettings(values)),
      invalidate: [["app-settings"]],
      success: "Settings saved",
    }),
  )
}
