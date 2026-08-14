import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { queueCampaign } from "@/features/project-mailer/server/project-mailer.service"

// POST /api/projects/:id/mailer/campaigns - queue a bulk send. Returns at once;
// the scheduler drains the queue.
export const POST = withProjectManager(async (req: NextRequest, { params }, session) =>
  respond(await queueCampaign(params.id, await req.json(), session), 201),
)
