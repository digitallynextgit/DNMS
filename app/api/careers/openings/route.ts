import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { createOpening } from "@/features/careers/server/careers.service"

export const POST = withErrorHandler(async (req: NextRequest) =>
  respond(await createOpening(await req.json())),
)
