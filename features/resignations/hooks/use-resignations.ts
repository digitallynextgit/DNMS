"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
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
  /** True only for HR/admin or a manager with reports; others are redirected. */
  authorized: boolean
  pagination: PaginationMeta
}

// ─── Queries ────────────────────────────────────────────────────────────────

export function useMyResignation() {
  return useQuery({
    queryKey: ["my-resignation"],
    queryFn: async () =>
      (await apiFetch<{ data: { data: MyResignation | null } }>("/api/resignations")).data.data,
  })
}

export function useResignationsToReview(filters: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ["resignations-review", filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.page != null) params.set("page", String(filters.page))
      if (filters.limit != null) params.set("limit", String(filters.limit))
      const qs = params.toString()
      return (
        await apiFetch<{ data: ResignationsToReviewResult }>(
          `/api/resignations/review${qs ? `?${qs}` : ""}`,
        )
      ).data
    },
    // Keep the panel live (matches the sidebar badge) so new requests appear
    // without a reload. The badge watcher also invalidates this on arrival.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}

/**
 * Live count of pending resignations the user can review, for the sidebar badge.
 * Polls every 30s (and on window focus) for near-real-time updates; mutations
 * below also invalidate it for instant updates on the reviewer's own actions.
 */
export function usePendingResignationCount() {
  return useQuery({
    queryKey: ["pending-resignation-count"],
    queryFn: async () =>
      (await apiFetch<{ data: { count: number } }>("/api/resignations/review/count")).data.count,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  })
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useApplyResignation() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: async (input: { reason?: string; requestedLastWorkingDate?: string }) =>
        (
          await apiFetch<{ data: unknown }>("/api/resignations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          })
        ).data,
      invalidate: [["my-resignation"], ["employee"], ["pending-resignation-count"]],
      onError: () => false,
    }),
  )
}

export function useCancelResignation() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: async (id: string) =>
        (await apiFetch<{ data: unknown }>(`/api/resignations/${id}`, { method: "DELETE" })).data,
      invalidate: [["my-resignation"], ["pending-resignation-count"]],
      onError: () => false,
    }),
  )
}

export function useReviewResignation() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: async (input: { id: string; action: "APPROVE" | "REJECT"; note?: string }) =>
        (
          await apiFetch<{ data: unknown }>(`/api/resignations/${input.id}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: input.action, note: input.note }),
          })
        ).data,
      invalidate: [["resignations-review"], ["employees"], ["pending-resignation-count"]],
      onError: () => false,
    }),
  )
}
