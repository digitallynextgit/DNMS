import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withMailerAccess } from "@/features/project-mailer/server/mailer-access"
import { sendTestEmail } from "@/features/project-mailer/server/project-mailer.service"

// POST /api/projects/:id/mailer/accounts/:mailerId/test - verify THIS account's
// credentials and send a real test email, recording the outcome on the row.
export const POST = withMailerAccess(async (req: NextRequest, { params }) =>
  respond(await sendTestEmail(params.id, params.mailerId, await req.json())),
)
