import { withSession, respond } from "@/server/api-handler"
import { getMyPendingItemCount } from "@/features/hr-checklists/server/checklists.queries"

export const GET = withSession(async () => respond(await getMyPendingItemCount()))
