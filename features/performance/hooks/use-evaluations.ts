"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { EvalCriterion } from "@/features/performance/evaluation"

export interface EvalPerson {
  id: string
  firstName: string
  lastName: string
  employeeNo: string
  profilePhoto: string | null
}

export interface Evaluation {
  id: string
  templateId: string | null
  criteria: EvalCriterion[]
  sectionALabel: string
  sectionBLabel: string
  employeeId: string
  managerId: string | null
  controllerId: string | null
  periodLabel: string
  periodStart: string | null
  periodEnd: string | null
  dueDate: string | null
  status: "PENDING" | "SELF_DONE" | "MANAGER_DONE" | "COMPLETED"
  selfRatings: Record<string, number> | null
  managerRatings: Record<string, number> | null
  controllerRatings: Record<string, number> | null
  selfComment: string | null
  managerComment: string | null
  controllerComment: string | null
  selfSubmittedAt: string | null
  managerSubmittedAt: string | null
  controllerSubmittedAt: string | null
  finalScore: number | null
  createdAt: string
  employee: EvalPerson
  manager: EvalPerson | null
  controller: EvalPerson | null
}

export type ViewerRole = "HR" | "MANAGER" | "CONTROLLER" | "EMPLOYEE"

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface EvalTemplate {
  id: string
  name: string
  sectionALabel: string
  sectionBLabel: string
  criteria: EvalCriterion[]
  isActive: boolean
}

// ─── Evaluations ──────────────────────────────────────────────────────────────

export function useEvaluations(params?: { status?: string; page?: number; limit?: number }) {
  const status = params?.status
  const page = params?.page ?? 1
  const limit = params?.limit ?? 10
  return useQuery({
    queryKey: ["evaluations", status ?? "all", page, limit],
    queryFn: (): Promise<{ data: Evaluation[]; pagination: PaginationMeta }> => {
      const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (status) qs.set("status", status)
      return apiFetch(`/api/performance/evaluations?${qs.toString()}`)
    },
    staleTime: 30_000,
  })
}

export function useEvaluation(id: string | null) {
  return useQuery({
    queryKey: ["evaluation", id],
    enabled: !!id,
    queryFn: (): Promise<{ data: Evaluation; viewerRole: ViewerRole }> =>
      apiFetch(`/api/performance/evaluations/${id}`),
  })
}

export function useCreateEvaluation() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (body: {
        employeeId: string
        managerId?: string
        controllerId?: string
        periodLabel: string
        periodStart?: string
        periodEnd?: string
        dueDate?: string
      }) =>
        apiFetch("/api/performance/evaluations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [["evaluations"]],
      success: "Evaluation created - employee and manager notified",
    }),
  )
}

export function useSubmitEvaluation(id: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (body: {
        role: "SELF" | "MANAGER" | "CONTROLLER"
        ratings: Record<string, number>
        comment?: string
      }) =>
        apiFetch(`/api/performance/evaluations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [["evaluation", id], ["evaluations"]],
      success: "Submitted",
    }),
  )
}

export function useDeleteEvaluation() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (id: string) =>
        apiFetch(`/api/performance/evaluations/${id}`, { method: "DELETE" }),
      invalidate: [["evaluations"]],
      success: "Evaluation deleted",
    }),
  )
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function useEvalTemplates() {
  return useQuery({
    queryKey: ["eval-templates"],
    queryFn: (): Promise<{
      data: EvalTemplate[]
      defaults: { criteria: EvalCriterion[]; sectionALabel: string; sectionBLabel: string }
    }> => apiFetch("/api/performance/eval-templates"),
  })
}

export function useSaveEvalTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id?: string
      name: string
      criteria: EvalCriterion[]
      sectionALabel?: string
      sectionBLabel?: string
    }) =>
      apiFetch(id ? `/api/performance/eval-templates/${id}` : "/api/performance/eval-templates", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eval-templates"] })
      toast.success("Template saved")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
