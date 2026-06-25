"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getMyResignation,
  applyResignation,
  cancelResignation,
  getResignationsToReview,
  reviewResignation,
} from "@/features/resignations/server/resignations.actions"
import { unwrap } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MyResignation {
  id: string
  reason: string | null
  requestedLastWorkingDate: string | null
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string
  reviewer: { id: string; firstName: string; lastName: string } | null
}

export interface ReviewableResignation {
  id: string
  reason: string | null
  requestedLastWorkingDate: string | null
  status: "PENDING"
  createdAt: string
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeNo: string
    email: string
    profilePhoto: string | null
    department: { name: string } | null
    designation: { title: string } | null
    manager: { id: string; firstName: string; lastName: string } | null
  }
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

interface ResignationsToReviewResult {
  data: ReviewableResignation[]
  canReviewAll: boolean
  pagination: PaginationMeta
}

// ─── Queries ────────────────────────────────────────────────────────────────

export function useMyResignation() {
  return useQuery({
    queryKey: ["my-resignation"],
    queryFn: async () => (unwrap(await getMyResignation()) as { data: MyResignation | null }).data,
  })
}

export function useResignationsToReview(filters: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ["resignations-review", filters],
    queryFn: async () =>
      unwrap(await getResignationsToReview(filters)) as ResignationsToReviewResult,
  })
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useApplyResignation() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: async (input: { reason?: string; requestedLastWorkingDate?: string }) =>
        unwrap(await applyResignation(input)),
      invalidate: [["my-resignation"], ["employee"]],
      onError: () => false,
    }),
  )
}

export function useCancelResignation() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: async (id: string) => unwrap(await cancelResignation(id)),
      invalidate: [["my-resignation"]],
      onError: () => false,
    }),
  )
}

export function useReviewResignation() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: async (input: { id: string; action: "APPROVE" | "REJECT"; note?: string }) =>
        unwrap(await reviewResignation(input.id, input.action, input.note)),
      invalidate: [["resignations-review"], ["employees"]],
      onError: () => false,
    }),
  )
}
