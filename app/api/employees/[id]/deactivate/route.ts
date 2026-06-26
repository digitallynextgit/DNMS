import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { deactivateEmployee } from "@/features/employees/server/employees.service"

// POST /api/employees/[id]/deactivate - soft-deactivate an employee.
export const POST = withErrorHandler(async (_req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  return respond(await deactivateEmployee(id))
})
