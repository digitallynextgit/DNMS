"use client"

import { FolderOpen } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Pagination } from "@/components/shared/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { DocumentCard } from "@/features/documents/components/document-card"
import {
  useEmployeeDocuments,
  useCompanyDocuments,
  useDeleteDocument,
  useDeleteEmployeeDocument,
} from "@/features/documents/hooks/use-documents"

interface DocumentListProps {
  employeeId?: string
  isLoading?: boolean
  canUpload?: boolean
  canDelete?: boolean
  selectedCategory?: string
  onUploadClick?: () => void
  /** Current page for the company-document list (server-side pagination). */
  page?: number
  /** Called when the user navigates the company-document pager. */
  onPageChange?: (page: number) => void
}

function DocumentListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-card flex items-center gap-4 rounded border p-4">
          <Skeleton className="h-10 w-10 rounded" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmployeeDocumentListInner({
  employeeId,
  canDelete,
  canUpload,
  onUploadClick,
}: {
  employeeId: string
  canDelete?: boolean
  canUpload?: boolean
  onUploadClick?: () => void
}) {
  const { data: documents, isLoading } = useEmployeeDocuments(employeeId)
  const deleteMutation = useDeleteEmployeeDocument(employeeId)

  if (isLoading) return <DocumentListSkeleton />

  if (!documents || documents.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No documents uploaded yet"
        description="Upload identity, academic, or employment documents for this employee."
        action={
          canUpload && onUploadClick
            ? { label: "Upload Document", onClick: onUploadClick }
            : undefined
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          employeeId={employeeId}
          canDelete={canDelete}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      ))}
    </div>
  )
}

function CompanyDocumentListInner({
  category,
  canDelete,
  canUpload,
  onUploadClick,
  page = 1,
  onPageChange,
}: {
  category?: string
  canDelete?: boolean
  canUpload?: boolean
  onUploadClick?: () => void
  page?: number
  onPageChange?: (page: number) => void
}) {
  const { data, isLoading } = useCompanyDocuments(category, page)
  const deleteMutation = useDeleteDocument()

  const documents = data?.data ?? []
  const pagination = data?.pagination

  if (isLoading) return <DocumentListSkeleton />

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No documents uploaded yet"
        description="Upload company policies, templates, and compliance documents."
        action={
          canUpload && onUploadClick
            ? { label: "Upload Document", onClick: onUploadClick }
            : undefined
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          canDelete={canDelete}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      ))}

      {pagination && onPageChange && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={onPageChange}
          itemLabel="document"
          className="pt-1"
        />
      )}
    </div>
  )
}

export function DocumentList({
  employeeId,
  canUpload,
  canDelete,
  selectedCategory,
  onUploadClick,
  page,
  onPageChange,
}: DocumentListProps) {
  if (employeeId) {
    return (
      <EmployeeDocumentListInner
        employeeId={employeeId}
        canDelete={canDelete}
        canUpload={canUpload}
        onUploadClick={onUploadClick}
      />
    )
  }

  return (
    <CompanyDocumentListInner
      category={selectedCategory}
      canDelete={canDelete}
      canUpload={canUpload}
      onUploadClick={onUploadClick}
      page={page}
      onPageChange={onPageChange}
    />
  )
}
