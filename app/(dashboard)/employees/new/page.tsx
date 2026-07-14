import { redirect } from "next/navigation"
import { PageHeader } from "@/components/shared/page-header"
import { EmployeeForm } from "@/features/employees"
import { getSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
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
        backHref="/employees/employee-directory"
        backLabel="Back to Employees"
      />

      <EmployeeForm mode="create" />
    </div>
  )
}
