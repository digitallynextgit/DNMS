import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withMailerAccess } from "@/features/project-mailer/server/mailer-access"
import {
  setRecipientSubscription,
  deleteRecipient,
} from "@/features/project-mailer/server/project-mailer.service"

// PATCH toggles the subscription; unsubscribing is checked again at send time.
export const PATCH = withMailerAccess(async (req: NextRequest, { params }) => {
  const body = await req.json()
  return respond(await setRecipientSubscription(params.id, params.recipientId, !!body.isSubscribed))
})

export const DELETE = withMailerAccess(async (_req, { params }) =>
  respond(await deleteRecipient(params.id, params.recipientId)),
)
