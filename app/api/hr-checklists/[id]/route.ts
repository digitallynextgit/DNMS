import { withSession, respond } from "@/server/api-handler"
import { getChecklist } from "@/features/hr-checklists/server/checklists.queries"

// HR, the employee, and any item owner (e.g. a department head) may read it; getChecklist() enforces it.
export const GET = withSession(async (_req, ctx) => respond(await getChecklist(ctx.params.id)))
