"use client"

import { useState } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import { FileLock2, Upload } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Tabs } from "@/components/ui/tabs"
import { TabsBar } from "@/components/shared/tabs-bar"
import { DocumentList, DocumentUploadDialog } from "@/features/documents"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { ADMIN_DOCUMENT_ROLES } from "@/lib/constants"

const CATEGORY_TABS = [
  { label: "All", value: "" },
  { label: "Policies", value: "COMPANY_POLICY" },
  { label: "Templates", value: "TEMPLATE" },
  { label: "Employment", value: "EMPLOYMENT" },
  { label: "Other", value: "OTHER" },
] as const

export default function AdminDocumentsPage() {
  const { roles, isAdmin_, isLoading } = usePermissions()
  // Admins and the HR team; the server refuses everyone else as well.
  const allowed = isAdmin_ || roles.some((r) => ADMIN_DOCUMENT_ROLES.includes(r))

  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [page, setPage] = useUrlPage()

  function handleCategoryChange(val: string) {
    setSelectedCategory(val)
    setPage(1)
  }

  if (isLoading) return null
  if (!allowed) {
    return (
      <EmptyState
        icon={FileLock2}
        title="Admin Documents"
        description="Only admins and HR can see these documents."
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Admin Documents"
        description="Seen by admins and HR only. Nobody else can see, open or download these."
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        }
      />

      <Tabs value={selectedCategory} onValueChange={handleCategoryChange} className="w-full">
        <TabsBar items={CATEGORY_TABS} />
      </Tabs>

      <DocumentList
        scope="admin"
        canUpload
        canDelete
        selectedCategory={selectedCategory || undefined}
        onUploadClick={() => setUploadOpen(true)}
        page={page}
        onPageChange={setPage}
      />

      <DocumentUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} adminOnly />
    </div>
  )
}
