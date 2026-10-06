import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { bulkDeleteEvaluations } from "@/features/performance/server/evaluation.service"

// POST /api/performance/evaluations/bulk-delete  { ids } - delete many at once (HR).
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { ids?: string[] }
  return respond(await bulkDeleteEvaluations(body.ids ?? []))
})
