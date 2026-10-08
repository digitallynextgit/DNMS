import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withMailerAccess } from "@/features/project-mailer/server/mailer-access"
import { importRecipients } from "@/features/project-mailer/server/project-mailer.service"

// Rows arrive already mapped - the .xlsx/.csv is parsed in the browser.
export const POST = withMailerAccess(async (req: NextRequest, { params }) =>
  respond(await importRecipients(params.id, await req.json()), 201),
)
