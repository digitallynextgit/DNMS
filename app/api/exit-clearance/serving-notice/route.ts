import { withSession, respond } from "@/server/api-handler"
import { listServingNotice } from "@/features/hr-checklists/server/exit.service"

// Accepted resignation + still-active account. Derived, never a stored status.
export const GET = withSession(async () => respond(await listServingNotice()))
