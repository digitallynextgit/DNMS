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

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const documentKeys = {
  all: ["documents"] as const,
  employee: (employeeId: string) => ["documents", "employee", employeeId] as const,
  company: (category?: string) => ["documents", "company", category ?? "all"] as const,
  url: (id: string) => ["documents", "url", id] as const,
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetch all documents belonging to a specific employee.
 */
export function useEmployeeDocuments(employeeId: string) {
  return useQuery<DocumentRecord[]>({
    queryKey: documentKeys.employee(employeeId),
    queryFn: async () => {
      const r = await getEmployeeDocuments(employeeId)
      if (!r.ok) throw new Error(r.error)
      return (r.data as { data: DocumentRecord[] }).data
    },
    enabled: Boolean(employeeId),
  })
}

/**
 * Fetch company-wide documents, optionally filtered by category.
 */
export function useCompanyDocuments(category?: string) {
  return useQuery<DocumentRecord[]>({
    queryKey: documentKeys.company(category),
    queryFn: async () => {
      const r = await getCompanyDocuments(category)
      if (!r.ok) throw new Error(r.error)
      return (r.data as { data: DocumentRecord[] }).data
    },
  })
}

/**
 * Upload a document via multipart FormData.
 */
export function useUploadDocument() {
  const qc = useQueryClient()

  return useMutation<DocumentRecord, Error, FormData>({
    mutationFn: async (formData: FormData) => {
      const r = await uploadDocument(formData)
      if (!r.ok) throw new Error(r.error)
      return (r.data as { data: DocumentRecord }).data
    },
    onSuccess: (doc) => {
      toast.success("Document uploaded successfully")
      // Invalidate both employee and company caches
      if (doc.employeeId) {
        qc.invalidateQueries({ queryKey: documentKeys.employee(doc.employeeId) })
      }
      qc.invalidateQueries({ queryKey: ["documents", "company"] })
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to upload document")
    },
  })
}

/**
 * Delete a document by id.
 */
export function useDeleteDocument() {
  const qc = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      const r = await deleteDocument(id)
      if (!r.ok) throw new Error(r.error)
    },
    onSuccess: () => {
      toast.success("Document deleted")
      qc.invalidateQueries({ queryKey: documentKeys.all })
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to delete document")
    },
  })
}

/**
 * Upload a PERSONAL (employee locker) document → /api/employees/[id]/documents.
 * Separate from useUploadDocument because the locker uses the EmployeeDocument
 * table, not the company Document table.
 */
export function useUploadEmployeeDocument(employeeId: string) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, FormData>({
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
    onSuccess: () => {
      toast.success("Document uploaded successfully")
      qc.invalidateQueries({ queryKey: documentKeys.employee(employeeId) })
    },
    onError: (error) => toast.error(error.message ?? "Failed to upload document"),
  })
}

/** Delete a personal (employee locker) document. */
export function useDeleteEmployeeDocument(employeeId: string) {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/employees/${employeeId}/documents/${docId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error?.message ?? "Delete failed")
      }
    },
    onSuccess: () => {
      toast.success("Document deleted")
      qc.invalidateQueries({ queryKey: documentKeys.employee(employeeId) })
    },
    onError: (error) => toast.error(error.message ?? "Failed to delete document"),
  })
}

/**
 * Fetch a pre-signed download URL for a document.
 * Disabled by default; enable by passing a valid id.
 */
export function useDocumentUrl(id: string | null) {
  return useQuery<DocumentUrlData>({
    queryKey: documentKeys.url(id ?? ""),
    queryFn: async () => {
      const r = await getDocumentUrl(id as string)
      if (!r.ok) throw new Error(r.error)
      return (r.data as { data: DocumentUrlData }).data
    },
    enabled: Boolean(id),
    staleTime: 10 * 60 * 1000, // 10 min - URL valid for 15 min
    gcTime: 12 * 60 * 1000,
  })
}
