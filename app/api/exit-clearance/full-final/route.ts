import { withSession, respond } from "@/server/api-handler"
import { createFullFinal, listFullFinal } from "@/features/full-final/server/fnf.service"

// Full & Final register: every leaver's FnF due date, release, notice period and relieving letter.
export const GET = withSession(async () => respond(await listFullFinal()))

export const POST = withSession(async (req) =>
  respond(await createFullFinal(await req.json().catch(() => null)), 201),
)
