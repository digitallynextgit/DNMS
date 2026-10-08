import { respond } from "@/server/api-handler"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { ackIncident } from "@/features/monitoring/server/monitoring.service"

// "I'm on it": freezes the escalation ladder without resolving the incident.
export const POST = withProjectAccess(async (_req, { params }, session) =>
  respond(await ackIncident(params.id, params.incidentId, session)),
)
