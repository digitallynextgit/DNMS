"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getMyResignation,
  applyResignation,
  cancelResignation,
  getResignationsToReview,
  reviewResignation,
} from "@/features/resignations/server/resignations.actions"

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

// ─── Queries ────────────────────────────────────────────────────────────────

export function useMyResignation() {
  return useQuery({
    queryKey: ["my-resignation"],
    queryFn: async () => {
      const r = await getMyResignation()
      if (!r.ok) throw new Error(r.error)
      return (r.data as { data: MyResignation | null }).data
    },
  })
}

export function useResignationsToReview() {
  return useQuery({
    queryKey: ["resignations-review"],
    queryFn: async () => {
      const r = await getResignationsToReview()
      if (!r.ok) throw new Error(r.error)
      return r.data as { data: ReviewableResignation[]; canReviewAll: boolean }
    },
  })
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useApplyResignation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { reason?: string; requestedLastWorkingDate?: string }) => {
      const r = await applyResignation(input)
      if (!r.ok) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-resignation"] })
      qc.invalidateQueries({ queryKey: ["employee"] })
    },
  })
}

export function useCancelResignation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await cancelResignation(id)
      if (!r.ok) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-resignation"] })
    },
  })
}

export function useReviewResignation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; action: "APPROVE" | "REJECT"; note?: string }) => {
      const r = await reviewResignation(input.id, input.action, input.note)
      if (!r.ok) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resignations-review"] })
      qc.invalidateQueries({ queryKey: ["employees"] })
    },
  })
}
