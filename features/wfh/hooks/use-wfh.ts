"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
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
  const r = await getWfhEligibility()
  if (!r.ok) throw new Error(r.error)
  return r.data as WfhEligibility
}

async function fetchWfhRequests(filters: WfhFilters): Promise<PaginatedResponse<WfhRequest>> {
  const r = await getWfhRequests(filters)
  if (!r.ok) throw new Error(r.error)
  return r.data as PaginatedResponse<WfhRequest>
}

async function applyWfh(body: {
  date: string
  reason?: string
  isEmergency?: boolean
}): Promise<{ data: WfhRequest; tier: number }> {
  const r = await applyWfhAction(body)
  if (!r.ok) throw new Error(r.error)
  return r.data as { data: WfhRequest; tier: number }
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
  const r = await updateWfhRequest(id, action, rejectionReason, approverRole)
  if (!r.ok) throw new Error(r.error)
  return r.data as { data: WfhRequest }
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
  return useMutation({
    mutationFn: applyWfh,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-wfh-requests"] })
      qc.invalidateQueries({ queryKey: ["wfh-requests"] })
      qc.invalidateQueries({ queryKey: ["wfh-eligibility"] })
      toast.success("WFH request submitted")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCancelWfh() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => patchWfh({ id, action: "CANCEL" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-wfh-requests"] })
      qc.invalidateQueries({ queryKey: ["wfh-requests"] })
      qc.invalidateQueries({ queryKey: ["wfh-eligibility"] })
      toast.success("WFH request cancelled")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useApproveWfh() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => patchWfh({ id, action: "APPROVE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wfh-requests"] })
      toast.success("WFH request approved")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRejectWfh() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) =>
      patchWfh({ id, action: "REJECT", rejectionReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wfh-requests"] })
      toast.success("WFH request rejected")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
