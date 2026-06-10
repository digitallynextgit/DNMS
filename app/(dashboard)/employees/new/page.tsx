import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { EmployeeForm } from "@/components/employees/employee-form"
import { getSession, hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"

export default async function NewEmployeePage() {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  if (!hasPermission(session, PERMISSIONS.EMPLOYEE_WRITE)) {
    redirect("/employees/employee-directory")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Employee"
        description="Create a new employee profile"
        actions={
          <Button variant="outline" asChild>
            <Link href="/employees/employee-directory" className="flex items-center gap-1.5">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <EmployeeForm mode="create" />
    </div>
  )
}
