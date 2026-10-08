import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import {
  getDesignations,
  createDesignation,
} from "@/features/employees/server/designations.service"

export const GET = withErrorHandler(async (req: NextRequest) => {
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true"
  return respond(await getDesignations({ includeInactive }))
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { title: string; level: number }
  return respond(await createDesignation(body))
})
