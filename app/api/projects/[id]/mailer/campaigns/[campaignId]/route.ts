import { respond } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import {
  getCampaignSends,
  cancelCampaign,
} from "@/features/project-mailer/server/project-mailer.service"

// GET    - per-recipient outcome for this campaign
// DELETE - cancel: drops the outstanding queue, keeps the log of what went out
export const GET = withProjectManager(async (_req, { params }) =>
  respond(await getCampaignSends(params.id, params.campaignId)),
)

export const DELETE = withProjectManager(async (_req, { params }, session) =>
  respond(await cancelCampaign(params.id, params.campaignId, session)),
)
