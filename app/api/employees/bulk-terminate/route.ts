import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { bulkTerminateEmployees } from "@/features/employees/server/employees.service"

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { ids?: string[] }
  return respond(await bulkTerminateEmployees(body.ids ?? []))
})
