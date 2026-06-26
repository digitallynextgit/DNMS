import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { updateSubDepartment, deleteSubDepartment } from "@/features/careers/server/careers.service"

export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) =>
  respond(await updateSubDepartment(ctx.params.id, await req.json())),
)

export const DELETE = withErrorHandler(async (_req: NextRequest, ctx: { params: { id: string } }) =>
  respond(await deleteSubDepartment(ctx.params.id)),
)
