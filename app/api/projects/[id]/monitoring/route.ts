import { respond } from "@/server/api-handler"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { getProjectMonitoring } from "@/features/monitoring/server/monitoring.service"

export const GET = withProjectAccess(async (_req, { params }) =>
  respond(await getProjectMonitoring(params.id)),
)
