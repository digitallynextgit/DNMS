import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { listChecklists } from "@/features/hr-checklists/server/checklists.queries"
import { startChecklist } from "@/features/hr-checklists/server/checklists.service"

// GET  /api/hr-checklists?kind=ONBOARDING - HR's list.
// POST /api/hr-checklists                 - start one by hand.
//
// The permission depends on `kind` (onboarding:write vs exit:write), so the
// services resolve and enforce it rather than the route guessing here.
export const GET = withSession(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  return respond(
    await listChecklists({
      kind: (sp.get("kind") as "ONBOARDING" | "EXIT") ?? "ONBOARDING",
      status: (sp.get("status") as "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "ALL") ?? undefined,
      search: sp.get("search") ?? undefined,
      page: sp.get("page") ?? undefined,
      limit: sp.get("limit") ?? undefined,
    } as never),
  )
})

export const POST = withSession(async (req: NextRequest) => {
  const body = (await req.json()) as { employeeId?: string; kind?: "ONBOARDING" | "EXIT" }
  return respond(await startChecklist(body.employeeId ?? "", body.kind ?? "ONBOARDING"), 201)
})
