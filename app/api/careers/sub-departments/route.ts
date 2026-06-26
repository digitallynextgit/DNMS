import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { createSubDepartment } from "@/features/careers/server/careers.service"

export const POST = withErrorHandler(async (req: NextRequest) =>
  respond(await createSubDepartment(await req.json())),
)
