"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Upload } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { DocumentList } from "@/features/documents"
import { DocumentUploadDialog } from "@/features/documents"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import { getEmployee } from "@/features/employees"

function useEmployeeName(employeeId: string) {
  const [name, setName] = React.useState<string>("")

  React.useEffect(() => {
    if (!employeeId) return
    getEmployee(employeeId)
      .then((r) => {
        if (!r.ok) return
        const emp = (r.data as { data: { firstName: string; lastName: string } }).data
        if (emp) setName(`${emp.firstName} ${emp.lastName}`)
      })
      .catch(() => {})
  }, [employeeId])

  return name
}

export default function EmployeeDocumentsPage() {
  const params = useParams()
  const id = params.id as string

  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.DOCUMENT_WRITE)
  const canDelete = can(PERMISSIONS.DOCUMENT_DELETE)

  const employeeName = useEmployeeName(id)
  const [uploadOpen, setUploadOpen] = React.useState(false)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={employeeName ? `Documents - ${employeeName}` : "Employee Documents"}
        description="Personal documents, certificates, and employment records."
        actions={
          canWrite ? (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          ) : undefined
        }
      />

      <DocumentList
        employeeId={id}
        canUpload={canWrite}
        canDelete={canDelete}
        onUploadClick={() => setUploadOpen(true)}
      />

      <DocumentUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} employeeId={id} />
    </div>
  )
}
