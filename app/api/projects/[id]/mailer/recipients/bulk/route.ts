import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withMailerAccess } from "@/features/project-mailer/server/mailer-access"
import {
  addRecipientsBulk,
  deleteRecipientsBulk,
} from "@/features/project-mailer/server/project-mailer.service"

// POST /api/projects/:id/mailer/recipients/bulk - paste-import a list.
export const POST = withMailerAccess(async (req: NextRequest, { params }) =>
  respond(await addRecipientsBulk(params.id, await req.json()), 201),
)

// DELETE /api/projects/:id/mailer/recipients/bulk - remove the selected rows.
//
// The ids travel in the BODY, not the query string: a selection is routinely a
// few hundred uuids, which is past what a URL can carry reliably, and they are
// not a resource address - they are the argument to one operation.
export const DELETE = withMailerAccess(async (req: NextRequest, { params }) =>
  respond(await deleteRecipientsBulk(params.id, await req.json())),
)
