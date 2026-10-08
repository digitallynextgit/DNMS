import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { createAsset } from "@/features/monitoring/server/monitoring.service"

export const POST = withProjectAccess(async (req: NextRequest, { params }, session) =>
  respond(await createAsset(params.id, await req.json(), session), 201),
)
