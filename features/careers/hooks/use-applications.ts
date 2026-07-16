"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"

export type CareerApplicationStatus =
  | "RECEIVED"
  | "IN_REVIEW"
  | "SHORTLISTED"
  | "REJECTED"
  | "HIRED"

export interface CareerApplication {
  id: string
  mode: "FULL_TIME" | "INTERNSHIP"
  groupSlug: string
  departmentSlug: string
  roleSlug: string
  groupCode: string
  departmentTitle: string
  roleTitle: string
  opening: string | null
  careerRoleId: string | null
  roleResolved: boolean
  fullName: string
  email: string
  phone: string
  linkedIn: string
  portfolio: string
  resumeUrl: string
  message: string | null
  submittedAt: string
  sourceUrl: string
  isRepeat: boolean
  status: CareerApplicationStatus
  hrNotes: string | null
  createdAt: string
}

interface ApplicationsResponse {
  data: CareerApplication[]
  meta: { total: number; page: number; limit: number; totalPages: number; newCount: number }
}

export function useCareerApplications(params: {
  page: number
  status: string
  mode: string
  q: string
}) {
  const search = new URLSearchParams({
    page: String(params.page),
    limit: "20",
    ...(params.status !== "all" ? { status: params.status } : {}),
    ...(params.mode !== "all" ? { mode: params.mode } : {}),
    ...(params.q ? { q: params.q } : {}),
  })
  return useQuery({
    queryKey: ["career-applications", params],
    queryFn: () => apiFetch<ApplicationsResponse>(`/api/recruitment/applications?${search}`),
    staleTime: 15_000,
    // New applications arrive from the public site, not from anything we do here.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  })
}

export function useUpdateApplication() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({
        id,
        body,
      }: {
        id: string
        body: { status?: CareerApplicationStatus; hrNotes?: string | null }
      }) =>
        apiFetch<{ data: CareerApplication }>(`/api/recruitment/applications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [["career-applications"]],
      success: "Application updated",
    }),
  )
}

/** Admin / HR-manager only - the API enforces it, this is just the client call. */
export function useDeleteApplication() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (id: string) =>
        apiFetch<{ message: string }>(`/api/recruitment/applications/${id}`, { method: "DELETE" }),
      invalidate: [["career-applications"]],
      success: "Application deleted",
    }),
  )
}
