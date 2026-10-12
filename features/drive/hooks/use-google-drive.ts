"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"
import type { DriveBrowseListing, DriveMoveJob, DriveMoveState, DriveStatus } from "../types"

const STATUS_KEY = ["google-drive-status"] as const
const MOVE_KEY = ["google-drive-move"] as const

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

export function useDriveStatus() {
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => apiFetch<{ data: DriveStatus }>("/api/admin/google-drive").then((r) => r.data),
    staleTime: 30_000,
    // Follow a backup while it runs.
    refetchInterval: (q) => (q.state.data?.backup.last?.status === "RUNNING" ? 4_000 : false),
  })
}

export function useDisconnectDrive() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: () => apiFetch("/api/admin/google-drive", { method: "DELETE" }),
      invalidate: [[...STATUS_KEY]],
      success: "Google account disconnected",
    }),
  )
}

export function useSetRepositoryStorage() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (storage: "b2" | "drive") =>
        apiFetch<{ data: { storage: "b2" | "drive" } }>(
          "/api/admin/google-drive/storage",
          json("PUT", { storage }),
        ).then((r) => r.data.storage),
      invalidate: [[...STATUS_KEY], [...MOVE_KEY]],
      success: (s) =>
        s === "drive"
          ? "New Repository uploads now go to Google Drive"
          : "New Repository uploads now go to Backblaze",
    }),
  )
}

export function useRunBackup() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: () => apiFetch("/api/admin/google-drive/backup", { method: "POST" }),
      // The run row appears a moment later; refetch so the card starts following it.
      onSuccess: () => {
        setTimeout(() => qc.invalidateQueries({ queryKey: STATUS_KEY }), 1_500)
      },
      success: "Backup started",
    }),
  )
}

export function useDriveMove(enabled: boolean) {
  return useQuery({
    queryKey: MOVE_KEY,
    queryFn: () =>
      apiFetch<{ data: DriveMoveState }>("/api/admin/google-drive/move").then((r) => r.data),
    enabled,
    refetchInterval: (q) => (q.state.data?.job?.running ? 2_000 : false),
  })
}

export function useStartMove() {
  const qc = useQueryClient()
  return useMutation(
    mutationWithToast(qc, {
      mutationFn: (projectId: string | null) =>
        apiFetch<{ data: DriveMoveJob }>(
          "/api/admin/google-drive/move",
          json("POST", { projectId }),
        ).then((r) => r.data),
      invalidate: [[...MOVE_KEY]],
    }),
  )
}

export function useDriveBrowse(folderId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["google-drive-browse", folderId ?? "root"],
    queryFn: () =>
      apiFetch<{ data: DriveBrowseListing }>(
        `/api/admin/google-drive/browse${folderId ? `?folder=${encodeURIComponent(folderId)}` : ""}`,
      ).then((r) => r.data),
    enabled,
    staleTime: 30_000,
  })
}
