import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { activateEmployee } from "@/features/employees/server/employees.service"

export const POST = withErrorHandler(async (_req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  return respond(await activateEmployee(id))
})
