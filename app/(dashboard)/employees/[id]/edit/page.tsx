"use client"

import { use } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { EmployeeForm } from "@/components/employees/employee-form"
import { useEmployee } from "@/hooks/use-employees"
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
        actions={
          <Button variant="outline" asChild>
            <Link href={`/employees/${id}`} className="flex items-center gap-1.5">
              <ChevronLeft className="h-4 w-4" />
              Back to Profile
            </Link>
          </Button>
        }
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
