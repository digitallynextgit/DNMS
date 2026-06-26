import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import {
  updateDesignation,
  deleteDesignation,
} from "@/features/employees/server/designations.service"

// PATCH /api/designations/[id] - update a designation.
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  const body = (await req.json()) as { title?: string; level?: number; isActive?: boolean }
  return respond(await updateDesignation(id, body))
})

// DELETE /api/designations/[id]?permanent=true - deactivate or hard-delete.
export const DELETE = withErrorHandler(
  async (req: NextRequest, ctx: { params: { id: string } }) => {
    const { id } = ctx.params
    const permanent = req.nextUrl.searchParams.get("permanent") === "true"
    return respond(await deleteDesignation(id, permanent))
  },
)
