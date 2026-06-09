"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  getLeaveTypes,
  createLeaveType as createLeaveTypeAction,
  updateLeaveType as updateLeaveTypeAction,
  deleteLeaveType as deleteLeaveTypeAction,
  getLeaveBalances,
  allocateLeave as allocateLeaveAction,
  getLeaveRequests,
  getTeamLeaveRequests,
  applyLeave as applyLeaveAction,
  updateLeaveRequest,
} from "@/lib/actions/leave"

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

async function fetchLeaveTypes(): Promise<{ data: LeaveType[] }> {
  const r = await getLeaveTypes()
  if (!r.ok) throw new Error(r.error)
  return r.data as { data: LeaveType[] }
}

async function createLeaveType(body: Partial<LeaveType>): Promise<{ data: LeaveType }> {
  const r = await createLeaveTypeAction(body as Record<string, unknown>)
  if (!r.ok) throw new Error(r.error)
  return r.data as { data: LeaveType }
}

async function updateLeaveType({
  id,
  body,
}: {
  id: string
  body: Partial<LeaveType>
}): Promise<{ data: LeaveType }> {
  const r = await updateLeaveTypeAction(id, body as Record<string, unknown>)
  if (!r.ok) throw new Error(r.error)
  return r.data as { data: LeaveType }
}

async function deleteLeaveType(id: string): Promise<{ message: string }> {
  const r = await deleteLeaveTypeAction(id)
  if (!r.ok) throw new Error(r.error)
  return r.data
}

async function fetchLeaveBalances(
  employeeId?: string,
  year?: number,
): Promise<{ data: LeaveBalance[] }> {
  const r = await getLeaveBalances(employeeId, year)
  if (!r.ok) throw new Error(r.error)
  return r.data as { data: LeaveBalance[] }
}

async function allocateLeave(body: {
  employeeId: string
  leaveTypeId: string
  year: number
  allocated: number
  carried?: number
}): Promise<{ data: LeaveBalance }> {
  const r = await allocateLeaveAction(body)
  if (!r.ok) throw new Error(r.error)
  return r.data as { data: LeaveBalance }
}

async function fetchLeaveRequests(
  filters: LeaveRequestFilters,
): Promise<PaginatedResponse<LeaveRequest>> {
  const r = await getLeaveRequests(filters)
  if (!r.ok) throw new Error(r.error)
  return r.data as PaginatedResponse<LeaveRequest>
}

async function fetchTeamLeaveRequests(filters: {
  status?: string
  page?: number
  limit?: number
}): Promise<PaginatedResponse<LeaveRequest>> {
  const r = await getTeamLeaveRequests(filters)
  if (!r.ok) throw new Error(r.error)
  return r.data as PaginatedResponse<LeaveRequest>
}

async function applyLeave(body: {
  leaveTypeId: string
  startDate: string
  endDate: string
  reason?: string
  isHalfDay?: boolean
}): Promise<{ data: LeaveRequest }> {
  const r = await applyLeaveAction(body)
  if (!r.ok) throw new Error(r.error)
  return r.data as { data: LeaveRequest }
}

async function cancelLeave(id: string): Promise<{ data: LeaveRequest }> {
  const r = await updateLeaveRequest(id, "CANCEL")
  if (!r.ok) throw new Error(r.error)
  return r.data as { data: LeaveRequest }
}

async function approveLeave(id: string): Promise<{ data: LeaveRequest }> {
  const r = await updateLeaveRequest(id, "APPROVE")
  if (!r.ok) throw new Error(r.error)
  return r.data as { data: LeaveRequest }
}

async function rejectLeave({
  id,
  rejectionReason,
}: {
  id: string
  rejectionReason: string
}): Promise<{ data: LeaveRequest }> {
  const r = await updateLeaveRequest(id, "REJECT", rejectionReason)
  if (!r.ok) throw new Error(r.error)
  return r.data as { data: LeaveRequest }
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

  return useMutation({
    mutationFn: applyLeave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] })
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] })
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] })
      toast.success("Leave request submitted successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to apply for leave")
    },
  })
}

export function useCancelLeave() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: cancelLeave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] })
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] })
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] })
      toast.success("Leave request cancelled")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel leave request")
    },
  })
}

export function useApproveLeave() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: approveLeave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] })
      queryClient.invalidateQueries({ queryKey: ["team-leave-requests"] })
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] })
      toast.success("Leave request approved")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to approve leave request")
    },
  })
}

export function useRejectLeave() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: rejectLeave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] })
      queryClient.invalidateQueries({ queryKey: ["team-leave-requests"] })
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] })
      toast.success("Leave request rejected")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reject leave request")
    },
  })
}

export function useCreateLeaveType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createLeaveType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] })
      toast.success("Leave type created successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create leave type")
    },
  })
}

export function useUpdateLeaveType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateLeaveType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] })
      toast.success("Leave type updated successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update leave type")
    },
  })
}

export function useDeleteLeaveType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteLeaveType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] })
      toast.success("Leave type deactivated successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to deactivate leave type")
    },
  })
}

export function useAllocateLeave() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: allocateLeave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] })
      toast.success("Leave balance allocated successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to allocate leave")
    },
  })
}
