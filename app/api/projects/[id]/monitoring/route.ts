import { respond } from "@/server/api-handler"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { getProjectMonitoring } from "@/features/monitoring/server/monitoring.service"

// GET /api/projects/:id/monitoring - this project's monitors, renewals and
// recent incidents. withProjectAccess resolves the slug and proves the caller
// may manage the project, so the service can trust ctx.params.id.
export const GET = withProjectAccess(async (_req, { params }) =>
  respond(await getProjectMonitoring(params.id)),
)
