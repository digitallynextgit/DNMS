"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"

export interface DocumentRecord {
  id: string
  title: string
  description: string | null
  category: string
  fileName: string
  fileSize: number
  mimeType: string
  objectKey: string
  version: number
  employeeId: string | null
  uploadedById: string
  isCompanyDoc: boolean
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  uploaderName?: string
}

export interface DocumentUrlData {
  url: string
  document: DocumentRecord
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface CompanyDocumentsResult {
  data: DocumentRecord[]
  pagination: PaginationMeta
}

export const documentKeys = {
  all: ["documents"] as const,
  employee: (employeeId: string) => ["documents", "employee", employeeId] as const,
  company: (category?: string, page?: number) =>
    ["documents", "company", category ?? "all", page ?? 1] as const,
  url: (id: string) => ["documents", "url", id] as const,
}

export function useEmployeeDocuments(employeeId: string) {
  return useQuery<DocumentRecord[]>({
    queryKey: documentKeys.employee(employeeId),
    queryFn: async () =>
      (
        await apiFetch<{ data: { data: DocumentRecord[] } }>(
          `/api/employees/${employeeId}/documents`,
        )
      ).data.data,
    enabled: Boolean(employeeId),
  })
}

export function useCompanyDocuments(category?: string, page = 1, limit = 10) {
  return useQuery<CompanyDocumentsResult>({
    queryKey: documentKeys.company(category, page),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (category) params.set("category", category)
      params.set("page", String(page))
      params.set("limit", String(limit))
      return (await apiFetch<{ data: CompanyDocumentsResult }>(`/api/documents?${params}`)).data
    },
  })
}

export function useUploadDocument() {
  const qc = useQueryClient()

  return useMutation<DocumentRecord, Error, FormData>(
    mutationWithToast(qc, {
      mutationFn: async (formData: FormData) =>
        (
          await apiFetch<{ data: { data: DocumentRecord } }>("/api/documents", {
            method: "POST",
            body: formData,
          })
        ).data.data,
      invalidate: [["documents", "company"]],
      success: "Document uploaded successfully",
      onSuccess: (doc) => {
        if (doc.employeeId) {
          qc.invalidateQueries({ queryKey: documentKeys.employee(doc.employeeId) })
        }
      },
      onError: (error) => {
        toast.error(error.message ?? "Failed to upload document")
      },
    }),
  )
}

export function useDeleteDocument() {
  const qc = useQueryClient()

  return useMutation<void, Error, string>(
    mutationWithToast(qc, {
      mutationFn: async (id: string) => {
        await apiFetch(`/api/documents/${id}`, { method: "DELETE" })
      },
      invalidate: [documentKeys.all],
      success: "Document deleted",
      onError: (error) => {
        toast.error(error.message ?? "Failed to delete document")
      },
    }),
  )
}

/** Personal locker documents live in the EmployeeDocument table, not Document. */
export function useUploadEmployeeDocument(employeeId: string) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, FormData>(
    mutationWithToast(qc, {
      mutationFn: async (formData: FormData) =>
        apiFetch(`/api/employees/${employeeId}/documents`, {
          method: "POST",
          body: formData,
        }),
      invalidate: [documentKeys.employee(employeeId)],
      success: "Document uploaded successfully",
      onError: (error) => {
        toast.error(error.message ?? "Failed to upload document")
      },
    }),
  )
}

export function useDeleteEmployeeDocument(employeeId: string) {
  const qc = useQueryClient()
  return useMutation<void, Error, string>(
    mutationWithToast(qc, {
      mutationFn: async (docId: string) => {
        await apiFetch(`/api/employees/${employeeId}/documents/${docId}`, {
          method: "DELETE",
        })
      },
      invalidate: [documentKeys.employee(employeeId)],
      success: "Document deleted",
      onError: (error) => {
        toast.error(error.message ?? "Failed to delete document")
      },
    }),
  )
}

export function useDocumentUrl(id: string | null) {
  return useQuery<DocumentUrlData>({
    queryKey: documentKeys.url(id ?? ""),
    queryFn: async () =>
      (await apiFetch<{ data: { data: DocumentUrlData } }>(`/api/documents/${id}`)).data.data,
    enabled: Boolean(id),
    staleTime: 10 * 60 * 1000, // 10 min - URL valid for 15 min
    gcTime: 12 * 60 * 1000,
  })
}
