import { withClientSession, respond } from "@/server/api-handler"
import { getClientOverview } from "@/features/client-portal/server/client-portal.queries"

// GET /api/portal/overview - the signed-in client's projects and packages.
export const GET = withClientSession(async () => respond(await getClientOverview()))
