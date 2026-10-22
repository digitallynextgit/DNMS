"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type {
  CreateLeadInput,
  ImportLeadsInput,
  LeadActivityInput,
  UpdateLeadInput,
} from "../schemas/sales.schema"
import type { LeadActivityRow, LeadRow } from "../types"

const base = (projectId: string) => `/api/projects/${projectId}/sales/leads`
const leadsKey = (projectId: string) => ["sales-leads", projectId] as const
const activityKey = (projectId: string, leadId: string) =>
  ["sales-lead-activity", projectId, leadId] as const
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

export function useLeads(projectId: string) {
  return useQuery({
    queryKey: leadsKey(projectId),
    queryFn: () => apiFetch<{ data: LeadRow[]; canManage: boolean }>(base(projectId)),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  })
}

export function useLeadActivities(projectId: string, leadId: string | null) {
  return useQuery({
    queryKey: activityKey(projectId, leadId ?? ""),
    queryFn: async () =>
      (await apiFetch<{ data: LeadActivityRow[] }>(`${base(projectId)}/${leadId}/activities`)).data,
    enabled: Boolean(projectId && leadId),
  })
}

export function useCreateLead(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: async (input: CreateLeadInput) =>
        (await apiFetch<{ data: LeadRow }>(base(projectId), json("POST", input))).data,
      invalidate: [leadsKey(projectId)],
      success: "Lead added",
    }),
  )
}

export function useUpdateLead(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: async ({ id, input }: { id: string; input: UpdateLeadInput }) =>
        (await apiFetch<{ data: LeadRow }>(`${base(projectId)}/${id}`, json("PATCH", input))).data,
      invalidate: [leadsKey(projectId), ["sales-lead-activity", projectId]],
      success: "Saved",
    }),
  )
}

export function useDeleteLead(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (id: string) => apiFetch(`${base(projectId)}/${id}`, json("DELETE")),
      invalidate: [leadsKey(projectId)],
      success: "Lead deleted",
    }),
  )
}

export function useImportLeads(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: async (input: ImportLeadsInput) =>
        (
          await apiFetch<{ data: { added: number; duplicates: number } }>(
            `${base(projectId)}/import`,
            json("POST", input),
          )
        ).data,
      invalidate: [leadsKey(projectId)],
      success: (r) =>
        `${r.added} lead${r.added === 1 ? "" : "s"} added${
          r.duplicates ? `, ${r.duplicates} already there` : ""
        }`,
    }),
  )
}

export function useAddLeadActivity(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: async ({ id, input }: { id: string; input: LeadActivityInput }) =>
        (
          await apiFetch<{ data: LeadRow }>(
            `${base(projectId)}/${id}/activities`,
            json("POST", input),
          )
        ).data,
      invalidate: [leadsKey(projectId), ["sales-lead-activity", projectId]],
      success: "Logged",
    }),
  )
}
