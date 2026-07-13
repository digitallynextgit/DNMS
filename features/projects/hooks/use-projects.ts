"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectListItem {
  id: string
  name: string
  code: string
  description: string | null
  status: string
  priority: string
  startDate: string | null
  endDate: string | null
  budget: number | null
  owner: { id: string; firstName: string; lastName: string; profilePhoto?: string | null }
  members: {
    employee: { id: string; firstName: string; lastName: string; profilePhoto: string | null }
  }[]
  _count: { tasks: number }
}

export interface EmployeeSnippet {
  id: string
  firstName: string
  lastName: string
  employeeNo?: string
  profilePhoto?: string | null
  designation?: { title: string } | null
}

export interface TeamMember {
  id: string
  teamId: string
  projectId: string
  employeeId: string
  joinedAt: string
  employee: EmployeeSnippet
}

export interface ProjectTeam {
  id: string
  projectId: string
  name: string
  description: string | null
  managerId: string | null
  manager: EmployeeSnippet | null
  members: TeamMember[]
  _count: { tasks: number }
  createdAt: string
}

export interface ProjectTask {
  id: string
  projectId: string
  teamId: string | null
  title: string
  description: string | null
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  approvalStatus: "APPROVED" | "PENDING_APPROVAL" | "REJECTED"
  isManagerCreated: boolean
  isMilestone: boolean
  rejectionReason: string | null
  assigneeId: string | null
  creatorId: string
  startDate: string | null
  dueDate: string | null
  completedAt: string | null
  estimatedHours: number | null
  loggedHours: number
  tags: string[]
  createdAt: string
  assignee: EmployeeSnippet | null
  creator?: EmployeeSnippet
  _count?: { comments: number; checklistItems: number }
}

export interface TaskComment {
  id: string
  taskId: string
  authorId: string
  content: string
  createdAt: string
  updatedAt: string
  author: EmployeeSnippet
}

export interface TaskChecklistItem {
  id: string
  taskId: string
  text: string
  isChecked: boolean
  displayOrder: number
  createdAt: string
}

export interface ProjectActivity {
  id: string
  projectId: string
  actorId: string
  type: string
  entityType: string | null
  entityId: string | null
  meta: Record<string, unknown> | null
  createdAt: string
  actor: EmployeeSnippet
}

export interface ProjectMessage {
  id: string
  projectId: string
  authorId: string
  title: string
  content: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
  author: EmployeeSnippet
}

export interface ProjectResource {
  id: string
  projectId: string
  teamId: string | null
  category: "BRIEFS" | "ASSETS" | "DELIVERABLES" | "REFERENCES" | "OTHER"
  fileName: string
  fileSize: number
  mimeType: string
  description: string | null
  uploadedById: string
  createdAt: string
  uploadedBy: EmployeeSnippet
  team: { id: string; name: string } | null
}

// Projects
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch<{ data: ProjectListItem[] }>("/api/projects?limit=100"),
    staleTime: 30_000,
  })
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () =>
      apiFetch<{ data: ProjectListItem & { teams: ProjectTeam[]; tasks: ProjectTask[] } }>(
        `/api/projects/${id}`,
      ),
    enabled: !!id,
    staleTime: 30_000,
  })
}

// Teams
export function useProjectTeams(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-teams", projectId],
    queryFn: () => apiFetch<{ data: ProjectTeam[] }>(`/api/projects/${projectId}/teams`),
    enabled: !!projectId,
    staleTime: 30_000,
  })
}

export function useCreateTeam(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (body: { name: string; description?: string }) =>
        apiFetch<{ data: ProjectTeam }>(`/api/projects/${projectId}/teams`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [
        ["project-teams", projectId],
        ["project", projectId],
      ],
      success: "Team created",
    }),
  )
}

export function useUpdateTeam(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({ teamId, body }: { teamId: string; body: Record<string, unknown> }) =>
        apiFetch(`/api/projects/${projectId}/teams/${teamId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [
        ["project-teams", projectId],
        ["project", projectId],
      ],
      success: "Team updated",
    }),
  )
}

export function useDeleteTeam(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (teamId: string) =>
        apiFetch(`/api/projects/${projectId}/teams/${teamId}`, { method: "DELETE" }),
      invalidate: [
        ["project-teams", projectId],
        ["project", projectId],
      ],
      success: "Team deleted",
    }),
  )
}

// Team members
export function useAddTeamMember(projectId: string, teamId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (employeeId: string) =>
        apiFetch(`/api/projects/${projectId}/teams/${teamId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId }),
        }),
      invalidate: [["project-teams", projectId]],
      success: "Member added",
    }),
  )
}

export function useRemoveTeamMember(projectId: string, teamId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (memberId: string) =>
        apiFetch(`/api/projects/${projectId}/teams/${teamId}/members/${memberId}`, {
          method: "DELETE",
        }),
      invalidate: [["project-teams", projectId]],
      success: "Member removed",
    }),
  )
}

export function usePromoteTeamMember(projectId: string, teamId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (memberId: string) =>
        apiFetch(`/api/projects/${projectId}/teams/${teamId}/members/${memberId}/promote`, {
          method: "PATCH",
        }),
      invalidate: [["project-teams", projectId]],
      success: "Promoted to manager",
    }),
  )
}

// Tasks
export function useTeamTasks(projectId: string, teamId: string | undefined) {
  return useQuery({
    queryKey: ["team-tasks", projectId, teamId],
    queryFn: () =>
      apiFetch<{ data: ProjectTask[] }>(`/api/projects/${projectId}/teams/${teamId}/tasks`),
    enabled: !!teamId,
    staleTime: 15_000,
  })
}

export function useCreateTask(projectId: string, teamId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (body: Record<string, unknown>) =>
        apiFetch<{ data: ProjectTask }>(`/api/projects/${projectId}/teams/${teamId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [
        ["team-tasks", projectId, teamId],
        ["my-tasks"],
        ["project-all-tasks", projectId],
      ],
      success: "Task created",
    }),
  )
}

export function useApproveTask() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (taskId: string) => apiFetch(`/api/tasks/${taskId}/approve`, { method: "PATCH" }),
      invalidate: [["team-tasks"], ["my-tasks"], ["project-all-tasks"]],
      success: "Task approved",
    }),
  )
}

export function useRejectTask() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({ taskId, reason }: { taskId: string; reason: string }) =>
        apiFetch(`/api/tasks/${taskId}/reject`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }),
      invalidate: [["team-tasks"], ["my-tasks"], ["project-all-tasks"]],
      success: "Task rejected",
    }),
  )
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      taskId,
      body,
      silent,
    }: {
      taskId: string
      body: Record<string, unknown>
      silent?: boolean
    }) =>
      apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["team-tasks"] })
      qc.invalidateQueries({ queryKey: ["my-tasks"] })
      qc.invalidateQueries({ queryKey: ["project-all-tasks"] })
      if (!variables.silent) toast.success("Updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (taskId: string) => apiFetch(`/api/tasks/${taskId}`, { method: "DELETE" }),
      invalidate: [["team-tasks"], ["my-tasks"], ["project-all-tasks"]],
      success: "Task deleted",
    }),
  )
}

// Resources
export function useProjectResources(
  projectId: string | undefined,
  filters?: { teamId?: string; category?: string },
) {
  const params = new URLSearchParams()
  if (filters?.teamId !== undefined) params.set("teamId", filters.teamId)
  if (filters?.category) params.set("category", filters.category)
  return useQuery({
    queryKey: ["project-resources", projectId, filters],
    queryFn: () =>
      apiFetch<{ data: ProjectResource[] }>(`/api/projects/${projectId}/resources?${params}`),
    enabled: !!projectId,
    staleTime: 30_000,
  })
}

export function useUploadResource(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: async ({
        file,
        teamId,
        category,
        description,
      }: {
        file: File
        teamId?: string | null
        category: string
        description?: string
      }) => {
        const fd = new FormData()
        fd.append("file", file)
        if (teamId) fd.append("teamId", teamId)
        fd.append("category", category)
        if (description) fd.append("description", description)
        const res = await fetch(`/api/projects/${projectId}/resources`, {
          method: "POST",
          body: fd,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }))
          throw new Error(err.error?.message || "Upload failed")
        }
        return res.json()
      },
      invalidate: [["project-resources", projectId]],
      success: "File uploaded",
    }),
  )
}

export function useDeleteResource(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (fileId: string) =>
        apiFetch(`/api/projects/${projectId}/resources/${fileId}`, { method: "DELETE" }),
      invalidate: [["project-resources", projectId]],
      success: "File deleted",
    }),
  )
}

export async function getResourceDownloadUrl(projectId: string, fileId: string): Promise<string> {
  const res = await apiFetch<{ data: { signedUrl: string } }>(
    `/api/projects/${projectId}/resources/${fileId}`,
  )
  return res.data.signedUrl
}

// All tasks for a project (used by Kanban)
export function useProjectAllTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-all-tasks", projectId],
    queryFn: () => apiFetch<{ data: ProjectTask[] }>(`/api/projects/${projectId}/tasks`),
    enabled: !!projectId,
    staleTime: 15_000,
  })
}

export interface PasswordEntry {
  id: string
  label: string
  username: string | null
  url: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  createdBy: EmployeeSnippet
}

export function useProjectPasswords(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-passwords", projectId],
    queryFn: () => apiFetch<{ data: PasswordEntry[] }>(`/api/projects/${projectId}/passwords`),
    enabled: !!projectId,
    staleTime: 60_000,
  })
}

export function useRevealPassword(projectId: string) {
  return useMutation({
    mutationFn: (entryId: string) =>
      apiFetch<{ data: { password: string } }>(`/api/projects/${projectId}/passwords/${entryId}`),
  })
}

export function useCreatePassword(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (body: {
        label: string
        password: string
        username?: string
        url?: string
        notes?: string
      }) =>
        apiFetch<{ data: PasswordEntry }>(`/api/projects/${projectId}/passwords`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [["project-passwords", projectId]],
      success: "Entry saved",
    }),
  )
}

export function useUpdatePassword(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({
        entryId,
        body,
      }: {
        entryId: string
        body: Partial<{
          label: string
          password: string
          username: string
          url: string
          notes: string
        }>
      }) =>
        apiFetch(`/api/projects/${projectId}/passwords/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [["project-passwords", projectId]],
      success: "Entry updated",
    }),
  )
}

export function useDeletePassword(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (entryId: string) =>
        apiFetch(`/api/projects/${projectId}/passwords/${entryId}`, { method: "DELETE" }),
      invalidate: [["project-passwords", projectId]],
      success: "Entry deleted",
    }),
  )
}

// Task Comments
export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: () => apiFetch<{ data: TaskComment[] }>(`/api/tasks/${taskId}/comments`),
    enabled: !!taskId,
    staleTime: 15_000,
  })
}

export function useAddComment(taskId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (content: string) =>
        apiFetch<{ data: TaskComment }>(`/api/tasks/${taskId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }),
      invalidate: [["task-comments", taskId]],
    }),
  )
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (commentId: string) =>
        apiFetch(`/api/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" }),
      invalidate: [["task-comments", taskId]],
    }),
  )
}

// Task Checklist
export function useTaskChecklist(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-checklist", taskId],
    queryFn: () => apiFetch<{ data: TaskChecklistItem[] }>(`/api/tasks/${taskId}/checklist`),
    enabled: !!taskId,
    staleTime: 15_000,
  })
}

export function useAddChecklistItem(taskId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (text: string) =>
        apiFetch<{ data: TaskChecklistItem }>(`/api/tasks/${taskId}/checklist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        }),
      invalidate: [["task-checklist", taskId]],
    }),
  )
}

export function useToggleChecklistItem(taskId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({ itemId, isChecked }: { itemId: string; isChecked: boolean }) =>
        apiFetch(`/api/tasks/${taskId}/checklist/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isChecked }),
        }),
      invalidate: [["task-checklist", taskId]],
    }),
  )
}

export function useDeleteChecklistItem(taskId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (itemId: string) =>
        apiFetch(`/api/tasks/${taskId}/checklist/${itemId}`, { method: "DELETE" }),
      invalidate: [["task-checklist", taskId]],
    }),
  )
}

// Project Activity
export function useProjectActivity(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-activity", projectId],
    queryFn: () => apiFetch<{ data: ProjectActivity[] }>(`/api/projects/${projectId}/activity`),
    enabled: !!projectId,
    staleTime: 15_000,
  })
}

// Project Messages
export function useProjectMessages(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-messages", projectId],
    queryFn: () => apiFetch<{ data: ProjectMessage[] }>(`/api/projects/${projectId}/messages`),
    enabled: !!projectId,
    staleTime: 30_000,
  })
}

export function useCreateMessage(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (body: { title: string; content: string }) =>
        apiFetch<{ data: ProjectMessage }>(`/api/projects/${projectId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [
        ["project-messages", projectId],
        ["project-activity", projectId],
      ],
      success: "Message posted",
    }),
  )
}

export function useUpdateMessage(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({
        messageId,
        body,
      }: {
        messageId: string
        body: Partial<{ title: string; content: string; isPinned: boolean }>
      }) =>
        apiFetch(`/api/projects/${projectId}/messages/${messageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      invalidate: [["project-messages", projectId]],
    }),
  )
}

export function useDeleteMessage(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (messageId: string) =>
        apiFetch(`/api/projects/${projectId}/messages/${messageId}`, { method: "DELETE" }),
      invalidate: [["project-messages", projectId]],
      success: "Message deleted",
    }),
  )
}
