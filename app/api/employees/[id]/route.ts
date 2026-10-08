import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import {
  getEmployee,
  updateEmployee,
  deleteEmployeePermanent,
} from "@/features/employees/server/employees.service"

export const GET = withErrorHandler(async (_req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  return respond(await getEmployee(id))
})

export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  const body = await req.json()
  return respond(await updateEmployee(id, body))
})

export const DELETE = withErrorHandler(
  async (_req: NextRequest, ctx: { params: { id: string } }) => {
    const { id } = ctx.params
    return respond(await deleteEmployeePermanent(id))
  },
)
