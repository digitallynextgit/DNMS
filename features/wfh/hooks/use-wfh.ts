"use client"

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WfhEligibility {
  tier: 1 | 2 | 3
  label: string
  eligibleFromDate: string | null
  monthlyQuota: number
  usedThisMonth: number
  canApplyEmergencyOnly: boolean
  joiningDate: string | null
  probationEnd: string | null
}

export interface WfhEmployeeSnippet {
  id: string
  firstName: string
  lastName: string
  employeeNo: string
  profilePhoto: string | null
}

export interface WfhRequest {
  id: string
  employeeId: string
  date: string
  reason: string | null
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  isEmergency: boolean
  managerApproverId: string | null
  managerApprovedAt: string | null
  hrApproverId: string | null
  hrApprovedAt: string | null
  rejectionReason: string | null
  /** The reporting manager's advisory call; HR makes the final decision. */
  managerDecision: "APPROVED" | "REJECTED" | null
  createdAt: string
  updatedAt: string
  employee: WfhEmployeeSnippet
  managerApprover: { id: string; firstName: string; lastName: string } | null
  hrApprover: { id: string; firstName: string; lastName: string } | null
}

export interface WfhInbox {
  requests: WfhRequest[]
  isApprover: boolean
  pagination: { total: number; page: number; limit: number; totalPages: number }
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: { total: number; page: number; limit: number; totalPages: number }
}

interface WfhFilters {
  status?: string
  employeeId?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchEligibility(): Promise<WfhEligibility> {
  return (await apiFetch<{ data: WfhEligibility }>("/api/wfh/eligibility")).data
}

async function fetchWfhRequests(filters: WfhFilters): Promise<PaginatedResponse<WfhRequest>> {
  const params = new URLSearchParams()
  if (filters.status) params.set("status", filters.status)
  if (filters.employeeId) params.set("employeeId", filters.employeeId)
  if (filters.from) params.set("from", filters.from)
  if (filters.to) params.set("to", filters.to)
  if (filters.page != null) params.set("page", String(filters.page))
  if (filters.limit != null) params.set("limit", String(filters.limit))
  const qs = params.toString()
  return (
    await apiFetch<{ data: PaginatedResponse<WfhRequest> }>(
      `/api/wfh/requests${qs ? `?${qs}` : ""}`,
    )
  ).data
}

async function applyWfh(body: {
  date: string
  reason?: string
  isEmergency?: boolean
}): Promise<{ data: WfhRequest; tier: number }> {
  return (
    await apiFetch<{ data: { data: WfhRequest; tier: number } }>("/api/wfh/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).data
}

async function patchWfh({
  id,
  action,
  rejectionReason,
}: {
  id: string
  action: "CANCEL" | "APPROVE" | "REJECT"
  rejectionReason?: string
}): Promise<{ data: WfhRequest }> {
  return (
    await apiFetch<{ data: { data: WfhRequest } }>(`/api/wfh/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, rejectionReason }),
    })
  ).data
}

async function fetchWfhInbox(
  scope: "team" | "all",
  filters: { status?: string; page?: number; limit?: number },
): Promise<WfhInbox> {
  const params = new URLSearchParams({ scope })
  if (filters.status) params.set("status", filters.status)
  if (filters.page != null) params.set("page", String(filters.page))
  if (filters.limit != null) params.set("limit", String(filters.limit))
  return (await apiFetch<{ data: { data: WfhInbox } }>(`/api/wfh/my-team?${params.toString()}`))
    .data.data
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useWfhEligibility() {
  return useQuery({ queryKey: ["wfh-eligibility"], queryFn: fetchEligibility, staleTime: 60_000 })
}

export function useMyWfhRequests(filters: Omit<WfhFilters, "employeeId"> = {}) {
  return useQuery({
    queryKey: ["my-wfh-requests", filters],
    placeholderData: keepPreviousData,
    queryFn: () => fetchWfhRequests(filters),
    staleTime: 30_000,
  })
}

export function useWfhRequests(filters: WfhFilters = {}) {
  return useQuery({
    queryKey: ["wfh-requests", filters],
    placeholderData: keepPreviousData,
    queryFn: () => fetchWfhRequests(filters),
    staleTime: 30_000,
  })
}

/** Approver inbox. scope "team" = a manager's direct reports; "all" = HR view. */
export function useWfhInbox(
  scope: "team" | "all" = "team",
  filters: { status?: string; page?: number; limit?: number } = {},
) {
  return useQuery({
    queryKey: ["wfh-inbox", scope, filters],
    placeholderData: keepPreviousData,
    queryFn: () => fetchWfhInbox(scope, filters),
    staleTime: 30_000,
  })
}

export function useApplyWfh() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: applyWfh,
      invalidate: [["my-wfh-requests"], ["wfh-requests"], ["wfh-eligibility"]],
      success: "WFH request submitted",
      onError: (err) => {
        toast.error(err.message)
      },
    }),
  )
}

export function useCancelWfh() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (id: string) => patchWfh({ id, action: "CANCEL" }),
      invalidate: [["my-wfh-requests"], ["wfh-requests"], ["wfh-eligibility"]],
      success: "WFH request cancelled",
      onError: (err) => {
        toast.error(err.message)
      },
    }),
  )
}

export function useApproveWfh() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (id: string) => patchWfh({ id, action: "APPROVE" }),
      invalidate: [["wfh-requests"], ["wfh-inbox"], ["my-wfh-requests"]],
      success: "WFH request approved",
      onError: (err) => {
        toast.error(err.message)
      },
    }),
  )
}

export function useRejectWfh() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) =>
        patchWfh({ id, action: "REJECT", rejectionReason }),
      invalidate: [["wfh-requests"], ["wfh-inbox"], ["my-wfh-requests"]],
      success: "WFH request rejected",
      onError: (err) => {
        toast.error(err.message)
      },
    }),
  )
}
