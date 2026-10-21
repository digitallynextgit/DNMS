"use client"

import { useMutation, useQuery } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import { toastError } from "@/lib/error-message"
import type {
  CalendarSummary,
  DeliverablesSuggestion,
  GoalSplitSuggestion,
  TasksSuggestion,
} from "../server/ai-planning.service"
import type { GoalVerdict } from "../lib/goal-accountability"

/** Whether AI is set up - the suggest buttons only show when it is. */
export function useProjectAi(projectId: string) {
  const q = useQuery({
    queryKey: ["project-ai", projectId],
    queryFn: () =>
      apiFetch<{ data: { available: boolean } }>(`/api/projects/${projectId}/ai`).then(
        (r) => r.data,
      ),
    enabled: Boolean(projectId),
    staleTime: 10 * 60_000,
  })
  return q.data?.available === true
}

interface Shapes {
  goal_split: {
    body: {
      metricLabel?: string
      targetValue?: number | null
      services?: string[]
      seriesId?: string
    }
    out: GoalSplitSuggestion
  }
  deliverables: { body: { goalId: string }; out: DeliverablesSuggestion }
  tasks: { body: { deliverableId: string }; out: TasksSuggestion }
  explain_goal: {
    body: { goalId: string }
    out: { id: string; text: string; verdict: GoalVerdict }
  }
  calendar: {
    body: { workbookId: string; refresh?: boolean }
    out: { summary: CalendarSummary; generatedAt: string; cached: boolean }
  }
}

/** Ask for one AI draft. Nothing is saved to the plan by this. */
export function useAiSuggest<K extends keyof Shapes>(projectId: string, kind: K) {
  return useMutation({
    mutationFn: (body: Shapes[K]["body"]) =>
      apiFetch<{ data: Shapes[K]["out"] }>(`/api/projects/${projectId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...body }),
      }).then((r) => r.data),
    onError: (e) => toastError(e, "The AI couldn't help this time"),
  })
}

/** A draft was used to fill a form: recorded, never blocking. */
export function markAiSuggestionUsed(projectId: string, suggestionId: string) {
  void apiFetch(`/api/projects/${projectId}/ai/${suggestionId}`, { method: "POST" }).catch(() => {})
}
