import { withSession, respond } from "@/server/api-handler"
import { getMyPendingItemCount } from "@/features/hr-checklists/server/checklists.queries"

// Sidebar badge. A count, not the rows.
export const GET = withSession(async () => respond(await getMyPendingItemCount()))
