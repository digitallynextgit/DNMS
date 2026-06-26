import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getDepartments, createDepartment } from "@/features/employees/server/departments.service"

// GET /api/departments?includeInactive=true - list departments.
export const GET = withErrorHandler(async (req: NextRequest) => {
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true"
  return respond(await getDepartments({ includeInactive }))
})

// POST /api/departments - create a department.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { name: string; code: string; description?: string }
  return respond(await createDepartment(body))
})
