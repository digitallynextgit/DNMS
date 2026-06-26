"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeaveType {
  id: string
  name: string
  code: string
  description: string | null
  isPaid: boolean
  maxDaysPerYear: number
  carryForward: boolean
  maxCarryDays: number
  requiresApproval: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface LeaveBalance {
  id: string
  employeeId: string
  leaveTypeId: string
  year: number
  allocated: number
  used: number
  pending: number
  carried: number
  leaveType: LeaveType
}

export interface LeaveRequestEmployee {
  id: string
  firstName: string
  lastName: string
  employeeNo: string
  profilePhoto: string | null
  department?: { id: string; name: string } | null
}

export interface LeaveRequest {
  id: string
  employeeId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string | null
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  approverId: string | null
  approvedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
  employee: LeaveRequestEmployee
  leaveType: { id: string; name: string; code: string; isPaid: boolean }
  approver: { id: string; firstName: string; lastName: string } | null
}

export interface LeaveRequestFilters {
  status?: string
  employeeId?: string
  leaveTypeId?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

// Each endpoint returns the standard { success, data: P } envelope where P is
// this helper's declared return type, so we read one `.data` hop to get P.
async function fetchLeaveTypes(): Promise<{ data: LeaveType[] }> {
  return (await apiFetch<{ data: { data: LeaveType[] } }>("/api/leave/types")).data
}

async function createLeaveType(body: Partial<LeaveType>): Promise<{ data: LeaveType }> {
  return (
    await apiFetch<{ data: { data: LeaveType } }>("/api/leave/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).data
}

async function updateLeaveType({
  id,
  body,
}: {
  id: string
  body: Partial<LeaveType>
}): Promise<{ data: LeaveType }> {
  return (
    await apiFetch<{ data: { data: LeaveType } }>(`/api/leave/types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).data
}

async function deleteLeaveType(id: string): Promise<{ message: string }> {
  return (
    await apiFetch<{ data: { message: string } }>(`/api/leave/types/${id}`, { method: "DELETE" })
  ).data
}

async function fetchLeaveBalances(
  employeeId?: string,
  year?: number,
): Promise<{ data: LeaveBalance[] }> {
  const params = new URLSearchParams()
  if (employeeId) params.set("employeeId", employeeId)
  if (year !== undefined) params.set("year", String(year))
  const qs = params.toString()
  return (
    await apiFetch<{ data: { data: LeaveBalance[] } }>(`/api/leave/balances${qs ? `?${qs}` : ""}`)
  ).data
}

async function allocateLeave(body: {
  employeeId: string
  leaveTypeId: string
  year: number
  allocated: number
  carried?: number
}): Promise<{ data: LeaveBalance }> {
  return (
    await apiFetch<{ data: { data: LeaveBalance } }>("/api/leave/balances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).data
}

async function fetchLeaveRequests(
  filters: LeaveRequestFilters,
): Promise<PaginatedResponse<LeaveRequest>> {
  const params = new URLSearchParams()
  if (filters.status) params.set("status", filters.status)
  if (filters.employeeId) params.set("employeeId", filters.employeeId)
  if (filters.leaveTypeId) params.set("leaveTypeId", filters.leaveTypeId)
  if (filters.from) params.set("from", filters.from)
  if (filters.to) params.set("to", filters.to)
  if (filters.page !== undefined) params.set("page", String(filters.page))
  if (filters.limit !== undefined) params.set("limit", String(filters.limit))
  const qs = params.toString()
  return (
    await apiFetch<{ data: PaginatedResponse<LeaveRequest> }>(
      `/api/leave/requests${qs ? `?${qs}` : ""}`,
    )
  ).data
}

async function fetchTeamLeaveRequests(filters: {
  status?: string
  page?: number
  limit?: number
}): Promise<PaginatedResponse<LeaveRequest>> {
  const params = new URLSearchParams()
  if (filters.status) params.set("status", filters.status)
  if (filters.page !== undefined) params.set("page", String(filters.page))
  if (filters.limit !== undefined) params.set("limit", String(filters.limit))
  const qs = params.toString()
  return (
    await apiFetch<{ data: PaginatedResponse<LeaveRequest> }>(
      `/api/leave/team${qs ? `?${qs}` : ""}`,
    )
  ).data
}

async function applyLeave(body: {
  leaveTypeId: string
  startDate: string
  endDate: string
  reason?: string
  isHalfDay?: boolean
}): Promise<{ data: LeaveRequest }> {
  return (
    await apiFetch<{ data: { data: LeaveRequest } }>("/api/leave/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).data
}

async function cancelLeave(id: string): Promise<{ data: LeaveRequest }> {
  return (
    await apiFetch<{ data: { data: LeaveRequest } }>(`/api/leave/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CANCEL" }),
    })
  ).data
}

async function approveLeave(id: string): Promise<{ data: LeaveRequest }> {
  return (
    await apiFetch<{ data: { data: LeaveRequest } }>(`/api/leave/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "APPROVE" }),
    })
  ).data
}

async function rejectLeave({
  id,
  rejectionReason,
}: {
  id: string
  rejectionReason: string
}): Promise<{ data: LeaveRequest }> {
  return (
    await apiFetch<{ data: { data: LeaveRequest } }>(`/api/leave/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REJECT", rejectionReason }),
    })
  ).data
}

// ─── Query Hooks ───────────────────────────────────────────────────────────────

export function useLeaveTypes() {
  return useQuery({
    queryKey: ["leave-types"],
    queryFn: fetchLeaveTypes,
    staleTime: 300_000,
  })
}

export function useLeaveBalances(employeeId?: string, year?: number) {
  return useQuery({
    queryKey: ["leave-balances", employeeId, year],
    queryFn: () => fetchLeaveBalances(employeeId, year),
    staleTime: 60_000,
  })
}

export function useLeaveRequests(filters: LeaveRequestFilters = {}) {
  return useQuery({
    queryKey: ["leave-requests", filters],
    queryFn: () => fetchLeaveRequests(filters),
    staleTime: 30_000,
  })
}

export function useMyLeaveRequests(filters: Omit<LeaveRequestFilters, "employeeId"> = {}) {
  return useQuery({
    queryKey: ["my-leave-requests", filters],
    queryFn: () => fetchLeaveRequests(filters),
    staleTime: 30_000,
  })
}

export function useTeamLeaveRequests(
  filters: { status?: string; page?: number; limit?: number } = {},
) {
  return useQuery({
    queryKey: ["team-leave-requests", filters],
    queryFn: () => fetchTeamLeaveRequests(filters),
    staleTime: 30_000,
  })
}

// ─── Mutation Hooks ────────────────────────────────────────────────────────────

export function useApplyLeave() {
  const queryClient = useQueryClient()

  return useMutation(
    mutationWithToast(queryClient, {
      mutationFn: applyLeave,
      invalidate: [["my-leave-requests"], ["leave-requests"], ["leave-balances"]],
      success: "Leave request submitted successfully",
      onError: (error) => {
        toast.error(error.message || "Failed to apply for leave")
      },
    }),
  )
}

export function useCancelLeave() {
  const queryClient = useQueryClient()

  return useMutation(
    mutationWithToast(queryClient, {
      mutationFn: cancelLeave,
      invalidate: [["my-leave-requests"], ["leave-requests"], ["leave-balances"]],
      success: "Leave request cancelled",
      onError: (error) => {
        toast.error(error.message || "Failed to cancel leave request")
      },
    }),
  )
}

export function useApproveLeave() {
  const queryClient = useQueryClient()

  return useMutation(
    mutationWithToast(queryClient, {
      mutationFn: approveLeave,
      invalidate: [["leave-requests"], ["team-leave-requests"], ["leave-balances"]],
      success: "Leave request approved",
      onError: (error) => {
        toast.error(error.message || "Failed to approve leave request")
      },
    }),
  )
}

export function useRejectLeave() {
  const queryClient = useQueryClient()

  return useMutation(
    mutationWithToast(queryClient, {
      mutationFn: rejectLeave,
      invalidate: [["leave-requests"], ["team-leave-requests"], ["leave-balances"]],
      success: "Leave request rejected",
      onError: (error) => {
        toast.error(error.message || "Failed to reject leave request")
      },
    }),
  )
}

export function useCreateLeaveType() {
  const queryClient = useQueryClient()

  return useMutation(
    mutationWithToast(queryClient, {
      mutationFn: createLeaveType,
      invalidate: [["leave-types"]],
      success: "Leave type created successfully",
      onError: (error) => {
        toast.error(error.message || "Failed to create leave type")
      },
    }),
  )
}

export function useUpdateLeaveType() {
  const queryClient = useQueryClient()

  return useMutation(
    mutationWithToast(queryClient, {
      mutationFn: updateLeaveType,
      invalidate: [["leave-types"]],
      success: "Leave type updated successfully",
      onError: (error) => {
        toast.error(error.message || "Failed to update leave type")
      },
    }),
  )
}

export function useDeleteLeaveType() {
  const queryClient = useQueryClient()

  return useMutation(
    mutationWithToast(queryClient, {
      mutationFn: deleteLeaveType,
      invalidate: [["leave-types"]],
      success: "Leave type deactivated successfully",
      onError: (error) => {
        toast.error(error.message || "Failed to deactivate leave type")
      },
    }),
  )
}

export function useAllocateLeave() {
  const queryClient = useQueryClient()

  return useMutation(
    mutationWithToast(queryClient, {
      mutationFn: allocateLeave,
      invalidate: [["leave-balances"]],
      success: "Leave balance allocated successfully",
      onError: (error) => {
        toast.error(error.message || "Failed to allocate leave")
      },
    }),
  )
}
