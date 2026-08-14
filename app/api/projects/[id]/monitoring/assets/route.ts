import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { createAsset } from "@/features/monitoring/server/monitoring.service"

// POST /api/projects/:id/monitoring/assets - add a renewal to this project.
export const POST = withProjectManager(async (req: NextRequest, { params }, session) =>
  respond(await createAsset(params.id, await req.json(), session), 201),
)
