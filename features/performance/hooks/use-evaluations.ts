"use client"

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { EvalCriterion, EvalEvaluator, EvalSection } from "@/features/performance/evaluation"

export interface EvalPerson {
  id: string
  firstName: string
  lastName: string
  employeeNo: string
  profilePhoto: string | null
  designation?: { title: string } | null
}

export interface Evaluation {
  id: string
  selfCriteria: EvalCriterion[]
  managerCriteria: EvalCriterion[]
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

// ─── Evaluations ──────────────────────────────────────────────────────────────

export function useEvaluations(params?: {
  status?: string
  period?: string
  q?: string
  page?: number
  limit?: number
}) {
  const status = params?.status
  const period = params?.period
  const q = params?.q
  const page = params?.page ?? 1
  const limit = params?.limit ?? 10
  return useQuery({
    queryKey: ["evaluations", status ?? "all", period ?? "all", q ?? "", page, limit],
    placeholderData: keepPreviousData,
    queryFn: (): Promise<{ data: Evaluation[]; periods: string[]; pagination: PaginationMeta }> => {
      const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (status) qs.set("status", status)
      if (period) qs.set("period", period)
      if (q?.trim()) qs.set("q", q.trim())
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

/** Generate today's evaluation for EVERY active employee at once, notifying each
 *  (and their manager). Idempotent per day. */
export function useGenerateEvaluations() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ data: { periodLabel: string; created: number; skipped: number; total: number } }>(
        "/api/performance/evaluations/generate",
        { method: "POST" },
      ),
    onSuccess: (res) => {
      const { created, skipped, periodLabel } = res.data
      qc.invalidateQueries({ queryKey: ["evaluations"] })
      toast.success(
        created > 0
          ? `Generated ${created} evaluation${created === 1 ? "" : "s"} for ${periodLabel}${
              skipped ? ` (${skipped} already existed)` : ""
            } - everyone notified`
          : `All employees already have an evaluation for ${periodLabel}`,
      )
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Couldn't generate evaluations")
    },
  })
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

// ─── KPI / parameter profiles (per employee, reused each cycle) ────────────────

export interface PerfKpiRow {
  id: string
  evaluator: EvalEvaluator
  section: EvalSection
  label: string
  description: string | null
  order: number
}

export interface PerfKpiDraft {
  evaluator: EvalEvaluator
  section: EvalSection
  label: string
  description?: string | null
}

export interface PerfKpiProfileRow {
  id: string
  employeeNo: string
  firstName: string | null
  lastName: string | null
  profilePhoto: string | null
  designation: string | null
  department: string | null
  managerCount: number
  selfCount: number
  configured: boolean
}

export function usePerfKpiProfiles() {
  return useQuery({
    queryKey: ["perf-kpi-profiles"],
    queryFn: (): Promise<{ data: PerfKpiProfileRow[] }> =>
      apiFetch(`/api/performance/kpi-profiles`),
    staleTime: 30_000,
  })
}

export function usePerfKpiProfile(employeeId: string | null) {
  return useQuery({
    queryKey: ["perf-kpi-profile", employeeId],
    enabled: !!employeeId,
    queryFn: (): Promise<{ data: { employee: EvalPerson; items: PerfKpiRow[] } }> =>
      apiFetch(`/api/performance/kpi-profiles/${employeeId}`),
  })
}

export function useSavePerfKpiProfile(employeeId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (items: PerfKpiDraft[]) =>
        apiFetch(`/api/performance/kpi-profiles/${employeeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        }),
      invalidate: [["perf-kpi-profile", employeeId], ["perf-kpi-profiles"]],
      success: "KPI profile saved",
    }),
  )
}
