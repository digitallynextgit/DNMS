import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import {
  getMyResignation,
  applyResignation,
} from "@/features/resignations/server/resignations.service"

// GET /api/resignations - the current user's latest resignation (any status).
export const GET = withErrorHandler(async () => respond(await getMyResignation()))

// POST /api/resignations - employee submits a resignation request.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { reason?: string; requestedLastWorkingDate?: string }
  return respond(await applyResignation(body))
})
