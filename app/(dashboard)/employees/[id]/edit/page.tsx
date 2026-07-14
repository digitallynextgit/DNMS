"use client"

import { use } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { EmployeeForm } from "@/features/employees"
import { useEmployee } from "@/features/employees"
import { Skeleton } from "@/components/ui/skeleton"

export default function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading } = useEmployee(id)

  const emp = data?.data
  const fullName = emp ? `${emp.firstName} ${emp.lastName}` : "Employee"

  return (
    <div className="space-y-6">
      <PageHeader
        title={isLoading ? "Edit Employee" : `Edit - ${fullName}`}
        description="Update employee profile information"
        backHref={`/employees/${id}`}
        backLabel="Back to Profile"
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 rounded" />
          <Skeleton className="h-80 rounded" />
        </div>
      ) : (
        <EmployeeForm mode="edit" employeeId={id} />
      )}
    </div>
  )
}
