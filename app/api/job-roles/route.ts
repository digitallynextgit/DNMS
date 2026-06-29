import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getJobRoles, createJobRole } from "@/features/employees/server/job-roles.service"

// GET /api/job-roles?departmentId=&includeInactive=true - list job roles.
export const GET = withErrorHandler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  return respond(
    await getJobRoles({
      departmentId: sp.get("departmentId") || undefined,
      includeInactive: sp.get("includeInactive") === "true",
    }),
  )
})

// POST /api/job-roles - create a job role under a department.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { name: string; departmentId: string }
  return respond(await createJobRole(body))
})
