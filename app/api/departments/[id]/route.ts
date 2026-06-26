import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import {
  getDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/features/employees/server/departments.service"

// GET /api/departments/[id] - one department.
export const GET = withErrorHandler(async (_req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  return respond(await getDepartment(id))
})

// PATCH /api/departments/[id] - update a department.
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  const body = (await req.json()) as {
    name?: string
    code?: string
    description?: string | null
    headId?: string | null
    isActive?: boolean
    careersTone?: string | null
    careersJobsLabel?: string | null
  }
  return respond(await updateDepartment(id, body))
})

// DELETE /api/departments/[id]?permanent=true - deactivate or hard-delete.
export const DELETE = withErrorHandler(
  async (req: NextRequest, ctx: { params: { id: string } }) => {
    const { id } = ctx.params
    const permanent = req.nextUrl.searchParams.get("permanent") === "true"
    return respond(await deleteDepartment(id, permanent))
  },
)
