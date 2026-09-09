"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { DriveFile } from "@/lib/google-drive"
import type { DocTag } from "../lib/doc-tag"
import type { ProjectResource } from "./use-projects"

export interface FilePerson {
  id: string
  firstName: string
  lastName: string
  profilePhoto: string | null
}

export interface ProjectFolder {
  id: string
  projectId: string
  parentId: string | null
  name: string
  driveFolderId: string | null
  createdById: string
  createdAt: string
  updatedAt: string
  createdBy: FilePerson
}

export interface ProjectFolderRow extends ProjectFolder {
  /** Files + links + sub-folders + Drive files directly inside. */
  itemCount: number
}

export interface ProjectLink {
  id: string
  projectId: string
  folderId: string | null
  title: string
  url: string
  tag: DocTag | null
  description: string | null
  createdById: string
  createdAt: string
  updatedAt: string
  createdBy: FilePerson
}

export interface FolderListing {
  folder: { id: string; name: string; parentId: string | null } | null
  path: { id: string; name: string }[]
  folders: ProjectFolderRow[]
  files: ProjectResource[]
  links: ProjectLink[]
  driveFiles: DriveFile[]
  drive: { configured: boolean; folderLink: string | null; memberCount: number }
}

// Every write below invalidates the whole ["project-files", projectId] family:
// a move touches two folders, a rename touches breadcrumbs, and the listing is
// one cheap round trip - precise invalidation would buy nothing here.
const filesKey = (projectId: string) => ["project-files", projectId] as const
const foldersKey = (projectId: string) => ["project-folders", projectId] as const
const INVALIDATE = (projectId: string) => [
  [...filesKey(projectId)],
  [...foldersKey(projectId)],
  ["project-resources", projectId],
]

/** One folder of the Files tree (null = top level). Keeps the previous folder's
 *  rows on screen while the next one loads, so navigating doesn't flash empty. */
export function useProjectFiles(projectId: string, folderId: string | null) {
  return useQuery({
    queryKey: [...filesKey(projectId), folderId ?? "root"],
    queryFn: () =>
      apiFetch<{ data: FolderListing }>(
        `/api/projects/${projectId}/files${folderId ? `?folder=${encodeURIComponent(folderId)}` : ""}`,
      ).then((r) => r.data),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

/** Every folder in the project, flat - the "Move to..." picker builds the tree. */
export function useProjectFolders(projectId: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: foldersKey(projectId),
    queryFn: () =>
      apiFetch<{ data: ProjectFolder[] }>(`/api/projects/${projectId}/folders`).then((r) => r.data),
    staleTime: 30_000,
    enabled: opts?.enabled ?? true,
  })
}

const json = (body: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

export function useCreateFolder(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (input: { name: string; parentId: string | null }) =>
        apiFetch<{ data: ProjectFolder }>(`/api/projects/${projectId}/folders`, {
          method: "POST",
          ...json(input),
        }).then((r) => r.data),
      invalidate: INVALIDATE(projectId),
      success: (f) => `Folder "${f.name}" created`,
    }),
  )
}

/** Rename and/or move a folder (parentId null = top level). */
export function useUpdateFolder(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (input: { folderId: string; name?: string; parentId?: string | null }) =>
        apiFetch<{ data: ProjectFolder }>(`/api/projects/${projectId}/folders/${input.folderId}`, {
          method: "PATCH",
          ...json({ name: input.name, parentId: input.parentId }),
        }).then((r) => r.data),
      invalidate: INVALIDATE(projectId),
    }),
  )
}

export function useDeleteFolder(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (folderId: string) =>
        apiFetch(`/api/projects/${projectId}/folders/${folderId}`, { method: "DELETE" }),
      invalidate: INVALIDATE(projectId),
      success: "Folder deleted",
    }),
  )
}

export interface LinkInput {
  title: string
  url: string
  folderId: string | null
  tag: DocTag | null
  description: string | null
}

export function useCreateLink(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (input: LinkInput) =>
        apiFetch<{ data: ProjectLink }>(`/api/projects/${projectId}/links`, {
          method: "POST",
          ...json(input),
        }).then((r) => r.data),
      invalidate: INVALIDATE(projectId),
      success: "Link saved",
    }),
  )
}

export function useUpdateLink(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({ linkId, ...patch }: Partial<LinkInput> & { linkId: string }) =>
        apiFetch<{ data: ProjectLink }>(`/api/projects/${projectId}/links/${linkId}`, {
          method: "PATCH",
          ...json(patch),
        }).then((r) => r.data),
      invalidate: INVALIDATE(projectId),
    }),
  )
}

export function useDeleteLink(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (linkId: string) =>
        apiFetch(`/api/projects/${projectId}/links/${linkId}`, { method: "DELETE" }),
      invalidate: INVALIDATE(projectId),
      success: "Link removed",
    }),
  )
}

/** Rename / move / retag a Backblaze file. No success toast: callers batch these. */
export function useUpdateResource(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: ({
        fileId,
        ...patch
      }: {
        fileId: string
        fileName?: string
        folderId?: string | null
        tag?: DocTag | null
      }) =>
        apiFetch<{ data: ProjectResource }>(`/api/projects/${projectId}/resources/${fileId}`, {
          method: "PATCH",
          ...json(patch),
        }).then((r) => r.data),
      invalidate: INVALIDATE(projectId),
    }),
  )
}

/** Rename / move a Drive file (folderId is an app folder; null = project root). */
export function useUpdateDriveFile(projectId: string) {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (input: { fileId: string; name?: string; folderId?: string | null }) =>
        apiFetch<{ data: DriveFile }>(`/api/projects/${projectId}/drive/file`, {
          method: "PATCH",
          ...json(input),
        }).then((r) => r.data),
      invalidate: INVALIDATE(projectId),
    }),
  )
}
