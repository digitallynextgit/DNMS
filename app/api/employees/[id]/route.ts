import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import {
  getEmployee,
  updateEmployee,
  deleteEmployeePermanent,
} from "@/features/employees/server/employees.service"

// GET /api/employees/[id] - one employee (id or "<code>-<name>" slug).
export const GET = withErrorHandler(async (_req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  return respond(await getEmployee(id))
})

// PATCH /api/employees/[id] - update an employee.
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  const body = await req.json()
  return respond(await updateEmployee(id, body))
})

// DELETE /api/employees/[id] - permanently delete an (already deactivated) employee.
export const DELETE = withErrorHandler(
  async (_req: NextRequest, ctx: { params: { id: string } }) => {
    const { id } = ctx.params
    return respond(await deleteEmployeePermanent(id))
  },
)
