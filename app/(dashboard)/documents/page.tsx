"use client"

import { useState } from "react"
import { Upload } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DocumentList } from "@/components/documents/document-list"
import { DocumentUploadDialog } from "@/components/documents/document-upload-dialog"
import { usePermissions } from "@/hooks/use-permissions"
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

      <Tabs
        value={selectedCategory}
        onValueChange={(val) => setSelectedCategory(val)}
        className="w-full"
      >
        <TabsList className="mb-2">
          {CATEGORY_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DocumentList
        canUpload={canWrite}
        canDelete={canDelete}
        selectedCategory={selectedCategory || undefined}
        onUploadClick={() => setUploadOpen(true)}
      />

      <DocumentUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  )
}
