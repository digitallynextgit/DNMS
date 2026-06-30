import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getWfhInbox } from "@/features/wfh/server/wfh.service"

// GET /api/wfh/my-team?scope=team|all - WFH requests inbox. scope "team" = the
// caller's direct reports (manager tab); scope "all" = every request (HR).
export const GET = withErrorHandler(async (req: NextRequest) => {
  const sp = new URL(req.url).searchParams
  const scope = sp.get("scope") === "all" ? "all" : "team"
  return respond(
    await getWfhInbox(scope, {
      status: sp.get("status") ?? undefined,
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    }),
  )
})
