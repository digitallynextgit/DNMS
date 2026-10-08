import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { updateStockIssue, deleteStockIssue } from "@/features/stock/server/stock.service"

// employeeId: a string links, null unlinks, absent leaves it alone.
export const PATCH = withErrorHandler(
  async (req: NextRequest, ctx: { params: Record<string, string> }) =>
    respond(await updateStockIssue(ctx.params.id!, await req.json())),
)

export const DELETE = withErrorHandler(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) =>
    respond(await deleteStockIssue(ctx.params.id!)),
)
