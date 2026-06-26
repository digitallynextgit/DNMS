import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { createRole } from "@/features/careers/server/careers.service"

export const POST = withErrorHandler(async (req: NextRequest) =>
  respond(await createRole(await req.json())),
)
