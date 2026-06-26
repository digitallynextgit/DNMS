import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getCareersTree, createGroup } from "@/features/careers/server/careers.service"

// GET /api/careers - full careers tree (all statuses) for the admin manager.
export const GET = withErrorHandler(async () => respond(await getCareersTree()))

// POST /api/careers - create a career group.
export const POST = withErrorHandler(async (req: NextRequest) =>
  respond(await createGroup(await req.json())),
)
