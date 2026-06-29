"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"

export interface JobRole {
  id: string
  name: string
  departmentId: string
  isActive: boolean
  department: { id: string; name: string; code: string }
  _count: { employees: number }
}

export function useJobRoles(opts?: { departmentId?: string; includeInactive?: boolean }) {
  const params = new URLSearchParams()
  if (opts?.departmentId) params.set("departmentId", opts.departmentId)
  if (opts?.includeInactive) params.set("includeInactive", "true")
  const qs = params.toString()
  return useQuery({
    queryKey: ["job-roles", opts?.departmentId ?? "all", opts?.includeInactive ?? false],
    queryFn: async () =>
      (await apiFetch<{ data: JobRole[] }>(`/api/job-roles${qs ? `?${qs}` : ""}`)).data,
    staleTime: 60_000,
  })
}

export function useCreateJobRole() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast<unknown, { name: string; departmentId: string }>(qc, {
      mutationFn: (body) =>
        apiFetch("/api/job-roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [["job-roles"]],
      success: "Job role added",
    }),
  )
}

export function useUpdateJobRole() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast<
      unknown,
      { id: string; body: { name?: string; departmentId?: string; isActive?: boolean } }
    >(qc, {
      mutationFn: ({ id, body }) =>
        apiFetch(`/api/job-roles/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [["job-roles"]],
      success: "Job role updated",
    }),
  )
}

export function useDeleteJobRole() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast<unknown, { id: string; permanent?: boolean }>(qc, {
      mutationFn: ({ id, permanent }) =>
        apiFetch(`/api/job-roles/${id}${permanent ? "?permanent=true" : ""}`, { method: "DELETE" }),
      invalidate: [["job-roles"]],
      success: "Job role removed",
    }),
  )
}
