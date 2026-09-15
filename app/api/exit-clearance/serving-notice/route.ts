import { withSession, respond } from "@/server/api-handler"
import { listServingNotice } from "@/features/hr-checklists/server/exit.service"

// Everyone currently serving notice: an accepted resignation and an account
// still active. Derived, never a stored status.
export const GET = withSession(async () => respond(await listServingNotice()))
