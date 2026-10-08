import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withMailerAccess } from "@/features/project-mailer/server/mailer-access"
import {
  addRecipientsBulk,
  deleteRecipientsBulk,
} from "@/features/project-mailer/server/project-mailer.service"

export const POST = withMailerAccess(async (req: NextRequest, { params }) =>
  respond(await addRecipientsBulk(params.id, await req.json()), 201),
)

// Ids travel in the body: a selection can be hundreds of uuids, too many for a URL.
export const DELETE = withMailerAccess(async (req: NextRequest, { params }) =>
  respond(await deleteRecipientsBulk(params.id, await req.json())),
)
