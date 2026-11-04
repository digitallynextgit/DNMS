import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { addAllEmployees, addOption } from "@/features/votes/server/votes.service"

// { allEmployees: true } puts every eligible employee on the ballot; otherwise one option.
export const POST = withSession(async (req: NextRequest, ctx, session) => {
  const body: unknown = await req.json()
  if (
    body &&
    typeof body === "object" &&
    (body as { allEmployees?: unknown }).allEmployees === true
  ) {
    return respond(await addAllEmployees(ctx.params.id, session), 201)
  }
  return respond(await addOption(ctx.params.id, body, session), 201)
})
