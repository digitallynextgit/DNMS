"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { ReminderPreference } from "../types"

const QUERY_KEY = ["task-reminder-preference"] as const
const ENDPOINT = "/api/notifications/task-reminders"

/** The caller's own reminder settings (the server fills in defaults). */
export function useTaskReminderPreference() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await apiFetch<{ data: ReminderPreference }>(ENDPOINT)).data,
    // Personal settings only this user can change - no need to re-fetch on focus.
    staleTime: 5 * 60_000,
  })
}

export function useUpdateTaskReminderPreference() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: async (values: ReminderPreference) =>
        (
          await apiFetch<{ data: ReminderPreference }>(ENDPOINT, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          })
        ).data,
      invalidate: [[...QUERY_KEY]],
      success: "Reminder settings saved",
    }),
  )
}
