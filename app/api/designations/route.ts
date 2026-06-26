import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import {
  getDesignations,
  createDesignation,
} from "@/features/employees/server/designations.service"

// GET /api/designations?includeInactive=true - list designations.
export const GET = withErrorHandler(async (req: NextRequest) => {
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true"
  return respond(await getDesignations({ includeInactive }))
})

// POST /api/designations - create a designation.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { title: string; level: number }
  return respond(await createDesignation(body))
})
