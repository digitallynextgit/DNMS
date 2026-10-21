"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api-fetch"
import { toastError } from "@/lib/error-message"
import type { DeliverableTasks, SplitLine } from "../server/deliverable-tasks.service"
import type { TaskWork } from "../server/task-work-logs.service"

/** Whom the signed-in person may give a task on this team to (the server's own rule). */
export function useTeamAssignable(projectId: string, teamId: string | null | undefined) {
  return useQuery({
    queryKey: ["team-assignable", projectId, teamId],
    queryFn: async () =>
      (
        await apiFetch<{ data: { ids: string[]; canAssignAnyone: boolean } }>(
          `/api/projects/${projectId}/teams/${teamId}/assignable`,
        )
      ).data,
    enabled: Boolean(projectId && teamId),
    staleTime: 60_000,
  })
}

export function useDeliverableTasks(projectId: string, deliverableId: string | null) {
  return useQuery({
    queryKey: ["deliverable-tasks", projectId, deliverableId],
    queryFn: async () =>
      (
        await apiFetch<{ data: DeliverableTasks }>(
          `/api/projects/${projectId}/deliverables/${deliverableId}/tasks`,
        )
      ).data,
    enabled: Boolean(projectId && deliverableId),
  })
}

export function useSplitDeliverable(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ deliverableId, tasks }: { deliverableId: string; tasks: SplitLine[] }) =>
      apiFetch<{ data: { created: number } }>(
        `/api/projects/${projectId}/deliverables/${deliverableId}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks }),
        },
      ),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["deliverable-tasks", projectId] })
      void qc.invalidateQueries({ queryKey: ["deliverables"] })
      void qc.invalidateQueries({ queryKey: ["project-goals", projectId] })
      void qc.invalidateQueries({ queryKey: ["tasks"] })
      const n = res.data.created
      toast.success(`Split into ${n} task${n === 1 ? "" : "s"}`)
    },
    onError: (e) => toastError(e, "Could not split it"),
  })
}

export function useTaskWork(taskId: string | null) {
  return useQuery({
    queryKey: ["task-work", taskId],
    queryFn: async () =>
      (await apiFetch<{ data: TaskWork }>(`/api/tasks/${taskId}/work-logs`)).data,
    enabled: Boolean(taskId),
  })
}

/** Adding and removing work logs; the deliverable and goal views refetch, since counts move. */
export function useTaskWorkLogMutations(taskId: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["task-work", taskId] })
    void qc.invalidateQueries({ queryKey: ["deliverables"] })
    void qc.invalidateQueries({ queryKey: ["deliverable-tasks"] })
    void qc.invalidateQueries({ queryKey: ["project-goals"] })
  }
  const add = useMutation({
    mutationFn: (body: {
      workedOn: string
      note: string
      quantity?: number | null
      links?: string[]
    }) =>
      apiFetch(`/api/tasks/${taskId}/work-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      invalidate()
      toast.success("Logged")
    },
    onError: (e) => toastError(e, "Could not log that"),
  })
  const remove = useMutation({
    mutationFn: (logId: string) =>
      apiFetch(`/api/tasks/${taskId}/work-logs/${logId}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate()
      toast.success("Log removed")
    },
    onError: (e) => toastError(e, "Could not remove it"),
  })
  return { add, remove }
}
