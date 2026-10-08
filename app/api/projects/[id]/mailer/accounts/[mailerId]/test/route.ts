import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withMailerAccess } from "@/features/project-mailer/server/mailer-access"
import { sendTestEmail } from "@/features/project-mailer/server/project-mailer.service"

// Sends a real test email and records the outcome on the row.
export const POST = withMailerAccess(async (req: NextRequest, { params }) =>
  respond(await sendTestEmail(params.id, params.mailerId, await req.json())),
)
