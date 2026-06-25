"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getEmployeeDocuments } from "@/features/documents/server/employee-documents.actions"
import {
  getCompanyDocuments,
  uploadDocument,
  deleteDocument,
  getDocumentUrl,
} from "@/features/documents/server/documents.actions"
import { unwrap } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query/mutation-with-toast"

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const documentKeys = {
  all: ["documents"] as const,
  employee: (employeeId: string) => ["documents", "employee", employeeId] as const,
  company: (category?: string, page?: number) =>
    ["documents", "company", category ?? "all", page ?? 1] as const,
  url: (id: string) => ["documents", "url", id] as const,
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetch all documents belonging to a specific employee.
 */
export function useEmployeeDocuments(employeeId: string) {
  return useQuery<DocumentRecord[]>({
    queryKey: documentKeys.employee(employeeId),
    queryFn: async () =>
      (unwrap(await getEmployeeDocuments(employeeId)) as { data: DocumentRecord[] }).data,
    enabled: Boolean(employeeId),
  })
}

/**
 * Fetch company-wide documents, optionally filtered by category. Paginated
 * (server-side); defaults to page 1, limit 10.
 */
export function useCompanyDocuments(category?: string, page = 1, limit = 10) {
  return useQuery<CompanyDocumentsResult>({
    queryKey: documentKeys.company(category, page),
    queryFn: async () =>
      unwrap(await getCompanyDocuments(category, { page, limit })) as CompanyDocumentsResult,
  })
}

/**
 * Upload a document via multipart FormData.
 */
export function useUploadDocument() {
  const qc = useQueryClient()

  return useMutation<DocumentRecord, Error, FormData>(
    mutationWithToast(qc, {
      mutationFn: async (formData: FormData) =>
        (unwrap(await uploadDocument(formData)) as { data: DocumentRecord }).data,
      invalidate: [["documents", "company"]],
      success: "Document uploaded successfully",
      onSuccess: (doc) => {
        // Invalidate both employee and company caches
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

/**
 * Delete a document by id.
 */
export function useDeleteDocument() {
  const qc = useQueryClient()

  return useMutation<void, Error, string>(
    mutationWithToast(qc, {
      mutationFn: async (id: string) => {
        unwrap(await deleteDocument(id))
      },
      invalidate: [documentKeys.all],
      success: "Document deleted",
      onError: (error) => {
        toast.error(error.message ?? "Failed to delete document")
      },
    }),
  )
}

/**
 * Upload a PERSONAL (employee locker) document → /api/employees/[id]/documents.
 * Separate from useUploadDocument because the locker uses the EmployeeDocument
 * table, not the company Document table.
 */
export function useUploadEmployeeDocument(employeeId: string) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, FormData>(
    mutationWithToast(qc, {
      mutationFn: async (formData: FormData) => {
        const res = await fetch(`/api/employees/${employeeId}/documents`, {
          method: "POST",
          body: formData,
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.error?.message ?? "Upload failed")
        }
        return res.json()
      },
      invalidate: [documentKeys.employee(employeeId)],
      success: "Document uploaded successfully",
      onError: (error) => {
        toast.error(error.message ?? "Failed to upload document")
      },
    }),
  )
}

/** Delete a personal (employee locker) document. */
export function useDeleteEmployeeDocument(employeeId: string) {
  const qc = useQueryClient()
  return useMutation<void, Error, string>(
    mutationWithToast(qc, {
      mutationFn: async (docId: string) => {
        const res = await fetch(`/api/employees/${employeeId}/documents/${docId}`, {
          method: "DELETE",
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.error?.message ?? "Delete failed")
        }
      },
      invalidate: [documentKeys.employee(employeeId)],
      success: "Document deleted",
      onError: (error) => {
        toast.error(error.message ?? "Failed to delete document")
      },
    }),
  )
}

/**
 * Fetch a pre-signed download URL for a document.
 * Disabled by default; enable by passing a valid id.
 */
export function useDocumentUrl(id: string | null) {
  return useQuery<DocumentUrlData>({
    queryKey: documentKeys.url(id ?? ""),
    queryFn: async () =>
      (unwrap(await getDocumentUrl(id as string)) as { data: DocumentUrlData }).data,
    enabled: Boolean(id),
    staleTime: 10 * 60 * 1000, // 10 min - URL valid for 15 min
    gcTime: 12 * 60 * 1000,
  })
}
