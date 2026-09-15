import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { uploadClientPlanFile } from "@/features/client-portal/server/client-plan.service"

// POST - upload a finished file against an item. A Route Handler rather than a
// server action because uploads exceed the 1 MB action body limit.
export const POST = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string; deliverableId: string } }) =>
    respond(
      await uploadClientPlanFile(params.projectRef, params.deliverableId, await req.formData()),
      201,
    ),
)
