import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { importRecipients } from "@/features/project-mailer/server/project-mailer.service"

// POST /api/projects/:id/mailer/recipients/import - commit a spreadsheet import.
//
// The .xlsx/.csv is parsed in the browser, so what arrives here is already mapped
// rows, not a file: the person confirms which column is the email address before
// anything is written, and the server never has to guess at a header name.
export const POST = withProjectManager(async (req: NextRequest, { params }) =>
  respond(await importRecipients(params.id, await req.json()), 201),
)
