import { withSession, respond } from "@/server/api-handler"
import { getMyChecklistItems } from "@/features/hr-checklists/server/checklists.queries"

// No permission scope: the approvers (Finance, IT, managers) hold no HR scope.
export const GET = withSession(async () => respond(await getMyChecklistItems()))
