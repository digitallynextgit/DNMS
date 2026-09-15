import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import {
  listClientPlan,
  createClientPlanLines,
} from "@/features/client-portal/server/client-plan.service"

// GET  /api/portal/projects/:projectRef/plan - what is planned and what is made
// POST /api/portal/projects/:projectRef/plan - the client plans a period
//
// Both services re-prove the grant AND the "plan" module, and every query is
// filtered on the resolved project id - the projectRef is a lookup key, never
// an authorisation.
export const GET = withClientSession(async (_req, { params }: { params: { projectRef: string } }) =>
  respond(await listClientPlan(params.projectRef)),
)

export const POST = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string } }) =>
    respond(await createClientPlanLines(params.projectRef, await req.json()), 201),
)
