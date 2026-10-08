import { withClientSession, respond } from "@/server/api-handler"
import { getClientOverview } from "@/features/client-portal/server/client-portal.queries"

export const GET = withClientSession(async () => respond(await getClientOverview()))
