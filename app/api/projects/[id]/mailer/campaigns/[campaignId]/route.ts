import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withMailerAccess } from "@/features/project-mailer/server/mailer-access"
import {
  getCampaignSends,
  cancelCampaign,
  deleteCampaign,
} from "@/features/project-mailer/server/project-mailer.service"

// GET    - per-recipient outcome for this campaign
// DELETE - cancel: drops the outstanding queue, keeps the log of what went out
// DELETE ?purge=1 - remove the campaign and its log entirely
//
// The two are distinguished EXPLICITLY rather than inferred from status. "Stop
// this" and "destroy the record of this" are different intentions, and picking
// between them based on what the row happens to say is how a click meant to halt
// a send ends up erasing the evidence of one.
export const GET = withMailerAccess(async (_req, { params }) =>
  respond(await getCampaignSends(params.id, params.campaignId)),
)

export const DELETE = withMailerAccess(async (req: NextRequest, { params }, session) =>
  req.nextUrl.searchParams.get("purge") === "1"
    ? respond(await deleteCampaign(params.id, params.campaignId, session))
    : respond(await cancelCampaign(params.id, params.campaignId, session)),
)
