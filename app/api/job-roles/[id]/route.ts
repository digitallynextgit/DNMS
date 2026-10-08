import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { updateJobRole, deleteJobRole } from "@/features/employees/server/job-roles.service"

export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  const body = (await req.json()) as { name?: string; departmentId?: string; isActive?: boolean }
  return respond(await updateJobRole(id, body))
})

export const DELETE = withErrorHandler(
  async (req: NextRequest, ctx: { params: { id: string } }) => {
    const { id } = ctx.params
    const permanent = req.nextUrl.searchParams.get("permanent") === "true"
    return respond(await deleteJobRole(id, permanent))
  },
)
