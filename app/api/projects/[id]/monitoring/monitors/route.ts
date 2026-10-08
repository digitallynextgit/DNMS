import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { createMonitor } from "@/features/monitoring/server/monitoring.service"

export const POST = withProjectAccess(async (req: NextRequest, { params }, session) =>
  respond(await createMonitor(params.id, await req.json(), session), 201),
)
