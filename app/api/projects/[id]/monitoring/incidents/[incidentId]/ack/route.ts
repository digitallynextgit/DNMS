import { respond } from "@/server/api-handler"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { ackIncident } from "@/features/monitoring/server/monitoring.service"

// POST /api/projects/:id/monitoring/incidents/:incidentId/ack
// "I'm on it" - freezes the escalation ladder. Does not resolve the incident.
export const POST = withProjectAccess(async (_req, { params }, session) =>
  respond(await ackIncident(params.id, params.incidentId, session)),
)
