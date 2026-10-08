"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import {
  DELIVERABLE_STATUS_LABELS,
  MADE_STATUSES,
  OPEN_STATUSES,
  OUTCOME_STATUSES,
  STATUS_ORDER,
  allowedTransition,
  hasProof,
  latestCalendarDay,
  nextActions,
  type DeliverableActor,
  type DeliverableStatus,
} from "../lib/deliverable-lifecycle"

// Re-exported so components using the hook need no second import for the labels.
export {
  DELIVERABLE_STATUS_LABELS,
  MADE_STATUSES,
  OPEN_STATUSES,
  OUTCOME_STATUSES,
  STATUS_ORDER,
  allowedTransition,
  hasProof,
  latestCalendarDay,
  nextActions,
}
export type { DeliverableActor, DeliverableStatus }

// Types mirror deliverables.queries.ts.

export interface DeliverableFile {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  url: string
}

export interface DeliverableRow {
  id: string
  projectId: string
  project: { id: string; name: string; code: string; slug: string | null }
  team: { id: string; name: string } | null
  employee: { id: string; name: string; profilePhoto: string | null } | null
  loggedByName: string | null
  plannedByClient: boolean
  task: { id: string; title: string } | null
  goal: { id: string; title: string } | null
  type: string
  title: string
  quantity: number
  deliveredQuantity: number
  status: DeliverableStatus
  startedOn: string | null
  completedOn: string | null
  dueOn: string | null
  periodStart: string | null
  periodEnd: string | null
  revisionCount: number
  acceptedAt: string | null
  acceptedByName: string | null
  acceptedByClient: boolean
  verifiedByName: string | null
  verifiedAt: string | null
  sentBack: {
    by: string | null
    reason: string | null
    at: string
    byClient: boolean
  } | null
  links: string[]
  notes: string | null
  files: DeliverableFile[]
  verified: boolean
  locked: boolean
  hours: number | null
  hoursPerUnit: number | null
  createdAt: string
}

export interface DeliverableEventRow {
  id: string
  type: "CREATED" | "EDITED" | "STATUS_CHANGED" | "VERIFIED" | "UNVERIFIED" | "LOCKED_EDIT"
  fromStatus: DeliverableStatus | null
  toStatus: DeliverableStatus | null
  changes: Record<string, [unknown, unknown]> | null
  reason: string | null
  actorName: string | null
  actorIsClient: boolean
  createdAt: string
}

export interface TypeCount {
  type: string
  count: number
  hoursPerUnit: number | null
}

export interface DeliverablesOverview {
  total: number
  entries: number
  byType: TypeCount[]
  byProject: {
    id: string
    name: string
    code: string
    slug: string | null
    count: number
    byType: TypeCount[]
  }[]
  byPerson: {
    id: string
    name: string
    profilePhoto: string | null
    teamName: string | null
    count: number
    byType: TypeCount[]
  }[]
  byTeam: {
    id: string
    name: string
    projectId: string
    projectName: string
    projectCode: string
    count: number
    byType: TypeCount[]
  }[]
  byWeek: { weekStart: string; count: number }[]
  byStatus: { status: DeliverableStatus; entries: number; quantity: number }[]
  planned: { entries: number; quantity: number; overdue: number }
  hours: { attributed: number; attributedUnits: number; perUnit: number | null; coverage: number }
  types: string[]
  suggestedTypes: string[]
  rows: DeliverableRow[]
  truncated: boolean
}

export interface DeliverableFilters {
  projectId?: string
  employeeId?: string
  teamId?: string
  type?: string
  taskId?: string
  status?: DeliverableStatus[]
  from?: string | null
  to?: string | null
}

export interface DeliverableInput {
  /** null = nobody yet; the team in `teamId` owes it. Owed work only. */
  employeeId?: string | null
  /** Which team owes it. Required when employeeId is null. */
  teamId?: string | null
  type: string
  title: string
  quantity?: number
  /** How many are made so far. Marking DELIVERED needs this to reach quantity. */
  deliveredQuantity?: number
  status?: DeliverableStatus
  startedOn?: string | null
  /** Optional: owed work has no completion date, and DELIVERED defaults to today. */
  completedOn?: string | null
  dueOn?: string | null
  goalId?: string | null
  links?: string[]
  notes?: string | null
  taskId?: string | null
  /** Lay the same owed row down every week/month from dueOn. Owed work only. */
  repeat?: { every: "WEEK" | "MONTH"; count: number } | null
  /** Required when a PATCH also rejects or un-accepts the row. */
  reason?: string | null
  note?: string | null
}

export interface StatusChangeInput {
  id: string
  status: DeliverableStatus
  reason?: string | null
  completedOn?: string | null
  note?: string | null
}

function qs(f: DeliverableFilters, includeProject: boolean): string {
  const p = new URLSearchParams()
  if (includeProject && f.projectId) p.set("projectId", f.projectId)
  if (f.employeeId) p.set("employeeId", f.employeeId)
  if (f.teamId) p.set("teamId", f.teamId)
  if (f.type) p.set("type", f.type)
  if (f.taskId) p.set("taskId", f.taskId)
  if (f.status?.length) p.set("status", f.status.join(","))
  if (f.from) p.set("from", f.from)
  if (f.to) p.set("to", f.to)
  return p.toString()
}

export function useProjectDeliverables(projectId: string | undefined, f: DeliverableFilters = {}) {
  const q = qs(f, false)
  return useQuery({
    queryKey: ["deliverables", projectId, q],
    queryFn: () =>
      apiFetch<{ data: DeliverablesOverview }>(
        `/api/projects/${projectId}/deliverables${q ? `?${q}` : ""}`,
      ).then((r) => r.data),
    enabled: !!projectId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

/** Across the portfolio - the Progress page and its popups. */
export function useDeliverablesOverview(f: DeliverableFilters = {}, enabled = true) {
  const q = qs(f, true)
  return useQuery({
    queryKey: ["deliverables", "portfolio", q],
    queryFn: () =>
      apiFetch<{ data: DeliverablesOverview }>(
        `/api/projects/deliverables${q ? `?${q}` : ""}`,
      ).then((r) => r.data),
    enabled,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

/** One row's history; only fetched while a history dialog is open. */
export function useDeliverableEvents(
  projectId: string | undefined,
  deliverableId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ["deliverables", projectId, "events", deliverableId],
    queryFn: () =>
      apiFetch<{ data: DeliverableEventRow[] }>(
        `/api/projects/${projectId}/deliverables/${deliverableId}/events`,
      ).then((r) => r.data),
    enabled: enabled && !!projectId && !!deliverableId,
    staleTime: 30_000,
  })
}

/** CSV export URL (navigated to, so the attachment header works). Needs a real from/to range. */
export function deliverablesExportUrl(f: DeliverableFilters, client = false): string {
  const p = new URLSearchParams(qs(f, true))
  if (client) p.set("client", "1")
  return `/api/projects/deliverables/export?${p.toString()}`
}

const json = { "Content-Type": "application/json" }

/** Invalidates every ["deliverables"] view, plus goals - delivered work moves goal targets. */
export function useDeliverableMutations(projectId: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["deliverables"] })
    qc.invalidateQueries({ queryKey: ["project-goals"] })
    qc.invalidateQueries({ queryKey: ["goals-portfolio"] })
  }

  const create = useMutation({
    mutationFn: (body: DeliverableInput) =>
      apiFetch<{ data: { id: string; created: number } }>(
        `/api/projects/${projectId}/deliverables`,
        {
          method: "POST",
          headers: json,
          body: JSON.stringify(body),
        },
      ).then((r) => r.data),
    onSuccess: (_data, body) => {
      invalidate()
      toast.success(body.status && body.status !== "DELIVERED" ? "Planned" : "Logged")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<DeliverableInput>) =>
      apiFetch<{ data: DeliverableRow | null }>(`/api/projects/${projectId}/deliverables/${id}`, {
        method: "PATCH",
        headers: json,
        body: JSON.stringify(body),
      }).then((r) => r.data),
    onSuccess: () => {
      invalidate()
      toast.success("Saved")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /** The row actions: Start, Mark delivered, Accept, Request revision, Un-accept. */
  const setStatus = useMutation({
    mutationFn: ({ id, ...body }: StatusChangeInput) =>
      apiFetch<{ data: DeliverableRow | null }>(
        `/api/projects/${projectId}/deliverables/${id}/status`,
        { method: "POST", headers: json, body: JSON.stringify(body) },
      ).then((r) => r.data),
    onSuccess: (row) => {
      invalidate()
      toast.success(row ? DELIVERABLE_STATUS_LABELS[row.status] : "Updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /** Internal QC sign-off - a manager saying they have looked at it. */
  const verify = useMutation({
    mutationFn: ({ id, verified }: { id: string; verified: boolean }) =>
      apiFetch<{ data: DeliverableRow | null }>(
        `/api/projects/${projectId}/deliverables/${id}/verify`,
        { method: "POST", headers: json, body: JSON.stringify({ verified }) },
      ).then((r) => r.data),
    onSuccess: (_row, { verified }) => {
      invalidate()
      toast.success(verified ? "Verified" : "Verification removed")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/projects/${projectId}/deliverables/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate()
      toast.success("Removed - its files are still on the Files tab")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /** Files ride on the resources upload, linked to the entry. */
  const upload = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("category", "DELIVERABLES")
      fd.append("deliverableId", id)
      const res = await fetch(`/api/projects/${projectId}/resources`, { method: "POST", body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Upload failed")
      return res.json()
    },
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ["project-resources", projectId] })
      toast.success("File attached")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeFile = useMutation({
    mutationFn: (fileId: string) =>
      apiFetch(`/api/projects/${projectId}/resources/${fileId}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ["project-resources", projectId] })
      toast.success("File removed")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return { create, update, setStatus, verify, remove, upload, removeFile }
}

export function useMyOwedDeliverables(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["my-owed-deliverables"],
    queryFn: () =>
      apiFetch<{ data: { rows: DeliverableRow[]; overdue: number; unclaimed: number } }>(
        "/api/projects/my-deliverables",
      ).then((r) => r.data),
    enabled: opts.enabled ?? true,
    staleTime: 30_000,
  })
}
