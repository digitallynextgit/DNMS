"use client"

import { useState } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import { Upload } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Tabs } from "@/components/ui/tabs"
import { TabsBar } from "@/components/shared/tabs-bar"
import { DocumentList } from "@/features/documents"
import { DocumentUploadDialog } from "@/features/documents"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PERMISSIONS } from "@/lib/constants"

const CATEGORY_TABS = [
  { label: "All", value: "" },
  { label: "Policies", value: "COMPANY_POLICY" },
  { label: "Templates", value: "TEMPLATE" },
  { label: "Employment", value: "EMPLOYMENT" },
  { label: "Other", value: "OTHER" },
] as const

export default function CompanyDocumentsPage() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.DOCUMENT_WRITE)
  const canDelete = can(PERMISSIONS.DOCUMENT_DELETE)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [page, setPage] = useUrlPage()

  function handleCategoryChange(val: string) {
    setSelectedCategory(val)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Company Documents"
        description="Policies, templates, and company-wide reference documents."
        actions={
          canWrite ? (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          ) : undefined
        }
      />

      <Tabs value={selectedCategory} onValueChange={handleCategoryChange} className="w-full">
        <TabsBar items={CATEGORY_TABS} />
      </Tabs>

      <DocumentList
        canUpload={canWrite}
        canDelete={canDelete}
        selectedCategory={selectedCategory || undefined}
        onUploadClick={() => setUploadOpen(true)}
        page={page}
        onPageChange={setPage}
      />

      <DocumentUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  )
}
