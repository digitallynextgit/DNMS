"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { unwrap } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import {
  getWfhEligibility,
  getWfhRequests,
  applyWfh as applyWfhAction,
  updateWfhRequest,
} from "@/features/wfh/server/wfh.actions"

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
  createdAt: string
  updatedAt: string
  employee: WfhEmployeeSnippet
  managerApprover: { id: string; firstName: string; lastName: string } | null
  hrApprover: { id: string; firstName: string; lastName: string } | null
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
  return unwrap(await getWfhEligibility()) as WfhEligibility
}

async function fetchWfhRequests(filters: WfhFilters): Promise<PaginatedResponse<WfhRequest>> {
  return unwrap(await getWfhRequests(filters)) as PaginatedResponse<WfhRequest>
}

async function applyWfh(body: {
  date: string
  reason?: string
  isEmergency?: boolean
}): Promise<{ data: WfhRequest; tier: number }> {
  return unwrap(await applyWfhAction(body)) as { data: WfhRequest; tier: number }
}

async function patchWfh({
  id,
  action,
  rejectionReason,
  approverRole,
}: {
  id: string
  action: "CANCEL" | "APPROVE" | "REJECT"
  rejectionReason?: string
  approverRole?: "MANAGER" | "HR"
}): Promise<{ data: WfhRequest }> {
  return unwrap(await updateWfhRequest(id, action, rejectionReason, approverRole)) as {
    data: WfhRequest
  }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useWfhEligibility() {
  return useQuery({ queryKey: ["wfh-eligibility"], queryFn: fetchEligibility, staleTime: 60_000 })
}

export function useMyWfhRequests(filters: Omit<WfhFilters, "employeeId"> = {}) {
  return useQuery({
    queryKey: ["my-wfh-requests", filters],
    queryFn: () => fetchWfhRequests(filters),
    staleTime: 30_000,
  })
}

export function useWfhRequests(filters: WfhFilters = {}) {
  return useQuery({
    queryKey: ["wfh-requests", filters],
    queryFn: () => fetchWfhRequests(filters),
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
      invalidate: [["wfh-requests"]],
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
      invalidate: [["wfh-requests"]],
      success: "WFH request rejected",
      onError: (err) => {
        toast.error(err.message)
      },
    }),
  )
}
