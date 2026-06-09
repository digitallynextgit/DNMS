"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

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
  currentPhase?: { id: string; name: string; displayOrder: number } | null
  currentPhaseId?: string | null
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

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }))
    throw new Error(err.error || `${res.status}`)
  }
  return res.json()
}

// Projects
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api<{ data: ProjectListItem[] }>("/api/projects?limit=100"),
    staleTime: 30_000,
  })
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () =>
      api<{ data: ProjectListItem & { teams: ProjectTeam[]; tasks: ProjectTask[] } }>(
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
    queryFn: () => api<{ data: ProjectTeam[] }>(`/api/projects/${projectId}/teams`),
    enabled: !!projectId,
    staleTime: 30_000,
  })
}

export function useCreateTeam(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      api<{ data: ProjectTeam }>(`/api/projects/${projectId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-teams", projectId] })
      qc.invalidateQueries({ queryKey: ["project", projectId] })
      toast.success("Team created")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useUpdateTeam(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, body }: { teamId: string; body: Record<string, unknown> }) =>
      api(`/api/projects/${projectId}/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-teams", projectId] })
      qc.invalidateQueries({ queryKey: ["project", projectId] })
      toast.success("Team updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteTeam(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (teamId: string) =>
      api(`/api/projects/${projectId}/teams/${teamId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-teams", projectId] })
      qc.invalidateQueries({ queryKey: ["project", projectId] })
      toast.success("Team deleted")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// Team members
export function useAddTeamMember(projectId: string, teamId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (employeeId: string) =>
      api(`/api/projects/${projectId}/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-teams", projectId] })
      toast.success("Member added")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useRemoveTeamMember(projectId: string, teamId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) =>
      api(`/api/projects/${projectId}/teams/${teamId}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-teams", projectId] })
      toast.success("Member removed")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function usePromoteTeamMember(projectId: string, teamId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) =>
      api(`/api/projects/${projectId}/teams/${teamId}/members/${memberId}/promote`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-teams", projectId] })
      toast.success("Promoted to manager")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// Tasks
export function useTeamTasks(projectId: string, teamId: string | undefined) {
  return useQuery({
    queryKey: ["team-tasks", projectId, teamId],
    queryFn: () => api<{ data: ProjectTask[] }>(`/api/projects/${projectId}/teams/${teamId}/tasks`),
    enabled: !!teamId,
    staleTime: 15_000,
  })
}

export function useCreateTask(projectId: string, teamId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ data: ProjectTask }>(`/api/projects/${projectId}/teams/${teamId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-tasks", projectId, teamId] })
      qc.invalidateQueries({ queryKey: ["my-tasks"] })
      qc.invalidateQueries({ queryKey: ["project-all-tasks", projectId] })
      toast.success("Task created")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useApproveTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => api(`/api/tasks/${taskId}/approve`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-tasks"] })
      qc.invalidateQueries({ queryKey: ["my-tasks"] })
      qc.invalidateQueries({ queryKey: ["project-all-tasks"] })
      toast.success("Task approved")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useRejectTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, reason }: { taskId: string; reason: string }) =>
      api(`/api/tasks/${taskId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-tasks"] })
      qc.invalidateQueries({ queryKey: ["my-tasks"] })
      qc.invalidateQueries({ queryKey: ["project-all-tasks"] })
      toast.success("Task rejected")
    },
    onError: (e: Error) => toast.error(e.message),
  })
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
      api(`/api/tasks/${taskId}`, {
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
  return useMutation({
    mutationFn: (taskId: string) => api(`/api/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-tasks"] })
      qc.invalidateQueries({ queryKey: ["my-tasks"] })
      qc.invalidateQueries({ queryKey: ["project-all-tasks"] })
      toast.success("Task deleted")
    },
    onError: (e: Error) => toast.error(e.message),
  })
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
      api<{ data: ProjectResource[] }>(`/api/projects/${projectId}/resources?${params}`),
    enabled: !!projectId,
    staleTime: 30_000,
  })
}

export function useUploadResource(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
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
      const res = await fetch(`/api/projects/${projectId}/resources`, { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }))
        throw new Error(err.error || "Upload failed")
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-resources", projectId] })
      toast.success("File uploaded")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteResource(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fileId: string) =>
      api(`/api/projects/${projectId}/resources/${fileId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-resources", projectId] })
      toast.success("File deleted")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export async function getResourceDownloadUrl(projectId: string, fileId: string): Promise<string> {
  const res = await api<{ data: { signedUrl: string } }>(
    `/api/projects/${projectId}/resources/${fileId}`,
  )
  return res.data.signedUrl
}

// All tasks for a project (used by Kanban)
export function useProjectAllTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-all-tasks", projectId],
    queryFn: () => api<{ data: ProjectTask[] }>(`/api/projects/${projectId}/tasks`),
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
    queryFn: () => api<{ data: PasswordEntry[] }>(`/api/projects/${projectId}/passwords`),
    enabled: !!projectId,
    staleTime: 60_000,
  })
}

export function useRevealPassword(projectId: string) {
  return useMutation({
    mutationFn: (entryId: string) =>
      api<{ data: { password: string } }>(`/api/projects/${projectId}/passwords/${entryId}`),
  })
}

export function useCreatePassword(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      label: string
      password: string
      username?: string
      url?: string
      notes?: string
    }) =>
      api<{ data: PasswordEntry }>(`/api/projects/${projectId}/passwords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-passwords", projectId] })
      toast.success("Entry saved")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useUpdatePassword(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
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
      api(`/api/projects/${projectId}/passwords/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-passwords", projectId] })
      toast.success("Entry updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeletePassword(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entryId: string) =>
      api(`/api/projects/${projectId}/passwords/${entryId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-passwords", projectId] })
      toast.success("Entry deleted")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// Task Comments
export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: () => api<{ data: TaskComment[] }>(`/api/tasks/${taskId}/comments`),
    enabled: !!taskId,
    staleTime: 15_000,
  })
}

export function useAddComment(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) =>
      api<{ data: TaskComment }>(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-comments", taskId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) =>
      api(`/api/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-comments", taskId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// Task Checklist
export function useTaskChecklist(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-checklist", taskId],
    queryFn: () => api<{ data: TaskChecklistItem[] }>(`/api/tasks/${taskId}/checklist`),
    enabled: !!taskId,
    staleTime: 15_000,
  })
}

export function useAddChecklistItem(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (text: string) =>
      api<{ data: TaskChecklistItem }>(`/api/tasks/${taskId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-checklist", taskId] }),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useToggleChecklistItem(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, isChecked }: { itemId: string; isChecked: boolean }) =>
      api(`/api/tasks/${taskId}/checklist/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isChecked }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-checklist", taskId] }),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteChecklistItem(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) =>
      api(`/api/tasks/${taskId}/checklist/${itemId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-checklist", taskId] }),
    onError: (e: Error) => toast.error(e.message),
  })
}

// Project Activity
export function useProjectActivity(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-activity", projectId],
    queryFn: () => api<{ data: ProjectActivity[] }>(`/api/projects/${projectId}/activity`),
    enabled: !!projectId,
    staleTime: 15_000,
  })
}

// Project Messages
export function useProjectMessages(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-messages", projectId],
    queryFn: () => api<{ data: ProjectMessage[] }>(`/api/projects/${projectId}/messages`),
    enabled: !!projectId,
    staleTime: 30_000,
  })
}

export function useCreateMessage(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { title: string; content: string }) =>
      api<{ data: ProjectMessage }>(`/api/projects/${projectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-messages", projectId] })
      qc.invalidateQueries({ queryKey: ["project-activity", projectId] })
      toast.success("Message posted")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useUpdateMessage(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      messageId,
      body,
    }: {
      messageId: string
      body: Partial<{ title: string; content: string; isPinned: boolean }>
    }) =>
      api(`/api/projects/${projectId}/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-messages", projectId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteMessage(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (messageId: string) =>
      api(`/api/projects/${projectId}/messages/${messageId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-messages", projectId] })
      toast.success("Message deleted")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
