import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { bulkTerminateEmployees } from "@/features/employees/server/employees.service"

// POST /api/employees/bulk-terminate - terminate many employees at once.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { ids?: string[] }
  return respond(await bulkTerminateEmployees(body.ids ?? []))
})
