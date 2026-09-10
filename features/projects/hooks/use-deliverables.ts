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
  latestCalendarDay,
  nextActions,
  type DeliverableActor,
  type DeliverableStatus,
} from "../lib/deliverable-lifecycle"

// The lifecycle table is client-safe on purpose - the row's buttons and the
// server's rules come from the same file. Re-exported here so a component that
// already imports the hook does not need a second import for the labels.
export {
  DELIVERABLE_STATUS_LABELS,
  MADE_STATUSES,
  OPEN_STATUSES,
  OUTCOME_STATUSES,
  STATUS_ORDER,
  allowedTransition,
  latestCalendarDay,
  nextActions,
}
export type { DeliverableActor, DeliverableStatus }

// ─── Types mirror deliverables.queries.ts ─────────────────────────────────────

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
  /** The maker. Null while the row is still owed by the team and unclaimed. */
  employee: { id: string; name: string; profilePhoto: string | null } | null
  loggedByName: string | null
  task: { id: string; title: string } | null
  goal: { id: string; title: string } | null
  type: string
  title: string
  quantity: number
  status: DeliverableStatus
  startedOn: string | null
  /** Null only while the row is owed. */
  completedOn: string | null
  dueOn: string | null
  revisionCount: number
  acceptedAt: string | null
  acceptedByName: string | null
  links: string[]
  notes: string | null
  files: DeliverableFile[]
  verified: boolean
  /** The period has closed: only a project manager may still change this row. */
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
  /**
   * Every scope, not just one project. A team name is unique only inside its
   * project, so each row names the project too. `id` is the team's, or
   * `__no_team__:<projectId>` for output logged without one.
   */
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

// ─── Reads ────────────────────────────────────────────────────────────────────

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

/**
 * One project's ledger. Keyed under ["deliverables", projectId, ...] so every
 * write on that project invalidates the prefix and every open view refreshes.
 */
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

/**
 * One row's history. Only fetched when a history dialog is actually open - a
 * per-row events query would be one request per line of the ledger.
 */
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

/**
 * The download link for the CSV export. A plain URL rather than a mutation: the
 * browser has to navigate to it for the attachment header to do its job. The
 * server requires a real `from`/`to` range, so pass one.
 */
export function deliverablesExportUrl(f: DeliverableFilters, client = false): string {
  const p = new URLSearchParams(qs(f, true))
  if (client) p.set("client", "1")
  return `/api/projects/deliverables/export?${p.toString()}`
}

// ─── Writes ───────────────────────────────────────────────────────────────────

const json = { "Content-Type": "application/json" }

/**
 * Every mutation invalidates the whole ["deliverables"] prefix: a project's
 * ledger, the portfolio view and the Progress popups all read the same rows,
 * and a log entry that shows on one and not the others is a bug report. Goals
 * go with it - a delivered thing moves a goal's target, so a goal card still
 * reading 2 of 3 after the third one landed is the same bug wearing a hat.
 */
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

/**
 * What the signed-in person owes, across every project - their own rows plus
 * anything their team owes that nobody has picked up.
 *
 * Kept out of the per-project deliverables cache on purpose: this is a
 * cross-project inbox, and invalidating it from a single project's mutation
 * would leave the other projects' rows stale.
 */
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
