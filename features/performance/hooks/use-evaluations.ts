"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
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

async function jsonOrThrow(res: Response, fallback: string) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: fallback }))
    throw new Error(err.error?.message || fallback)
  }
  return res.json()
}

// ─── Evaluations ──────────────────────────────────────────────────────────────

export function useEvaluations(params?: { status?: string; page?: number; limit?: number }) {
  const status = params?.status
  const page = params?.page ?? 1
  const limit = params?.limit ?? 10
  return useQuery({
    queryKey: ["evaluations", status ?? "all", page, limit],
    queryFn: async (): Promise<{ data: Evaluation[]; pagination: PaginationMeta }> => {
      const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (status) qs.set("status", status)
      return jsonOrThrow(
        await fetch(`/api/performance/evaluations?${qs.toString()}`),
        "Failed to load evaluations",
      )
    },
    staleTime: 30_000,
  })
}

export function useEvaluation(id: string | null) {
  return useQuery({
    queryKey: ["evaluation", id],
    enabled: !!id,
    queryFn: async (): Promise<{ data: Evaluation; viewerRole: ViewerRole }> =>
      jsonOrThrow(await fetch(`/api/performance/evaluations/${id}`), "Failed to load evaluation"),
  })
}

export function useCreateEvaluation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      employeeId: string
      managerId?: string
      controllerId?: string
      periodLabel: string
      periodStart?: string
      periodEnd?: string
      dueDate?: string
    }) =>
      jsonOrThrow(
        await fetch("/api/performance/evaluations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        "Failed to create evaluation",
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evaluations"] })
      toast.success("Evaluation created - employee and manager notified")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useSubmitEvaluation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      role: "SELF" | "MANAGER" | "CONTROLLER"
      ratings: Record<string, number>
      comment?: string
    }) =>
      jsonOrThrow(
        await fetch(`/api/performance/evaluations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        "Failed to submit evaluation",
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evaluation", id] })
      qc.invalidateQueries({ queryKey: ["evaluations"] })
      toast.success("Submitted")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteEvaluation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      jsonOrThrow(
        await fetch(`/api/performance/evaluations/${id}`, { method: "DELETE" }),
        "Failed to delete evaluation",
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evaluations"] })
      toast.success("Evaluation deleted")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function useEvalTemplates() {
  return useQuery({
    queryKey: ["eval-templates"],
    queryFn: async (): Promise<{
      data: EvalTemplate[]
      defaults: { criteria: EvalCriterion[]; sectionALabel: string; sectionBLabel: string }
    }> => jsonOrThrow(await fetch("/api/performance/eval-templates"), "Failed to load templates"),
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
      jsonOrThrow(
        await fetch(
          id ? `/api/performance/eval-templates/${id}` : "/api/performance/eval-templates",
          {
            method: id ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        ),
        "Failed to save template",
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eval-templates"] })
      toast.success("Template saved")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
