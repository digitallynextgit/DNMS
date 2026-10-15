import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"
import { PageHeader } from "@/components/shared/page-header"
import { EmployeeForm } from "@/features/employees"
import { getSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"

type SearchParams = Record<string, string | string[] | undefined>

export default async function NewEmployeePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  if (!hasPermission(session, PERMISSIONS.EMPLOYEE_WRITE)) {
    redirect(await tenantPath("/employees/employee-directory"))
  }

  // ?type=intern comes from the Intern Directory: same form, preset to Intern.
  const sp = await searchParams
  const type = Array.isArray(sp.type) ? sp.type[0] : sp.type
  const isIntern = type === "intern"

  return (
    <div className="space-y-6">
      <PageHeader
        title={isIntern ? "Add Intern" : "Add Employee"}
        description={isIntern ? "Create a new intern profile" : "Create a new employee profile"}
        backHref={isIntern ? "/employees/intern-directory" : "/employees/employee-directory"}
        backLabel={isIntern ? "Back to Interns" : "Back to Employees"}
      />

      <EmployeeForm mode="create" defaultEmploymentType={isIntern ? "INTERN" : undefined} />
    </div>
  )
}
