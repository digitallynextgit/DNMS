import { withSession, respond } from "@/server/api-handler"
import { listCandidates } from "@/features/votes/server/votes.service"

// Admins and the HR team only (checked in the service).
export const GET = withSession(async (_req, _ctx, session) =>
  respond(await listCandidates(session)),
)
