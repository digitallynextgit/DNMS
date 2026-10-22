"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { CampaignTiming } from "../lib/campaigns"
import type { WorkbookTeamStatus } from "../lib/workbook-team-progress"
import type { CreateCampaignInput, UpdateCampaignInput } from "../schemas/campaign.schema"

export interface Campaign {
  id: string
  name: string
  brief: string | null
  startDate: string
  deadline: string
  services: string[]
  owner: { id: string; firstName: string; lastName: string; profilePhoto: string | null } | null
  workbookId: string | null
  timing: CampaignTiming
  progress: { total: number; done: number; stuck: number; overdue: number }
  teams: { name: string; status: WorkbookTeamStatus; dueOn: string | null; quantity: number }[]
}

const key = (projectId: string) => ["planner-campaigns", projectId] as const
// A campaign brings its own calendar, so the calendar index refreshes too.
const touched = (projectId: string) => [key(projectId), ["project-sheets", projectId]]
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

export function useCampaigns(projectId: string) {
  return useQuery({
    queryKey: key(projectId),
    queryFn: async () =>
      (await apiFetch<{ data: Campaign[] }>(`/api/projects/${projectId}/campaigns`)).data,
    enabled: Boolean(projectId),
    staleTime: 30_000,
  })
}

export function useCreateCampaign(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: async (input: CreateCampaignInput) =>
        (
          await apiFetch<{ data: Campaign }>(
            `/api/projects/${projectId}/campaigns`,
            json("POST", input),
          )
        ).data,
      invalidate: touched(projectId),
      success: "Campaign created with its calendar",
    }),
  )
}

export function useUpdateCampaign(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: async ({ id, input }: { id: string; input: UpdateCampaignInput }) =>
        (
          await apiFetch<{ data: Campaign }>(
            `/api/projects/${projectId}/campaigns/${id}`,
            json("PATCH", input),
          )
        ).data,
      invalidate: touched(projectId),
      success: "Campaign saved",
    }),
  )
}

export function useDeleteCampaign(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (id: string) =>
        apiFetch(`/api/projects/${projectId}/campaigns/${id}`, json("DELETE")),
      invalidate: touched(projectId),
      success: "Campaign deleted",
    }),
  )
}
