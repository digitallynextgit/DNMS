import { withSession, respond } from "@/server/api-handler"
import { getChecklist } from "@/features/hr-checklists/server/checklists.queries"

// Readable by HR, by the employee it is about, and by anyone who owns an item
// on it - a department head holds no HR scope and still has to see the exit
// they are being asked to sign. getChecklist() enforces that.
export const GET = withSession(async (_req, ctx) => respond(await getChecklist(ctx.params.id)))
