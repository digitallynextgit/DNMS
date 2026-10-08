import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import {
  listClientPlan,
  createClientPlanLines,
} from "@/features/client-portal/server/client-plan.service"

export const GET = withClientSession(async (_req, { params }: { params: { projectRef: string } }) =>
  respond(await listClientPlan(params.projectRef)),
)

export const POST = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string } }) =>
    respond(await createClientPlanLines(params.projectRef, await req.json()), 201),
)
