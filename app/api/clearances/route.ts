import { withSession, respond } from "@/server/api-handler"
import { getMyChecklistItems } from "@/features/hr-checklists/server/checklists.queries"

// Everything awaiting the caller's sign-off, across every open checklist.
// Deliberately NO permission scope - the people this serves (Finance, IT, a
// reporting manager) hold no HR scope, and gating it would lock out exactly the
// population the exit process depends on.
export const GET = withSession(async () => respond(await getMyChecklistItems()))
