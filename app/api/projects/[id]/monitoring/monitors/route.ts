import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { createMonitor } from "@/features/monitoring/server/monitoring.service"

// POST /api/projects/:id/monitoring/monitors - start watching a URL.
export const POST = withProjectManager(async (req: NextRequest, { params }, session) =>
  respond(await createMonitor(params.id, await req.json(), session), 201),
)
