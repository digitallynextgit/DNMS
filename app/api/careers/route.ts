import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getCareersTree, createGroup } from "@/features/careers/server/careers.service"

export const GET = withErrorHandler(async () => respond(await getCareersTree()))

export const POST = withErrorHandler(async (req: NextRequest) =>
  respond(await createGroup(await req.json())),
)
