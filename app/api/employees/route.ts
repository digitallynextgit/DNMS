import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getEmployees, createEmployee } from "@/features/employees/server/employees.service"

type EmployeeFilters = {
  search?: string
  departmentId?: string
  designationId?: string
  status?: string
  employmentType?: string
  page?: number
  limit?: number
}

// GET /api/employees - paginated, filterable employee list.
export const GET = withErrorHandler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const filters: EmployeeFilters = {}
  const search = sp.get("search")
  const departmentId = sp.get("departmentId")
  const designationId = sp.get("designationId")
  const status = sp.get("status")
  const employmentType = sp.get("employmentType")
  const page = sp.get("page")
  const limit = sp.get("limit")
  if (search) filters.search = search
  if (departmentId) filters.departmentId = departmentId
  if (designationId) filters.designationId = designationId
  if (status) filters.status = status
  if (employmentType) filters.employmentType = employmentType
  if (page) filters.page = Number(page)
  if (limit) filters.limit = Number(limit)
  return respond(await getEmployees(filters))
})

// POST /api/employees - create an employee.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json()
  return respond(await createEmployee(body))
})
