import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { updateStockIssue, deleteStockIssue } from "@/features/stock/server/stock.service"

// PATCH /api/stock/issues/[id] - edit, or link/unlink the employee
// (employeeId: string links, null unlinks, absent leaves it alone).
export const PATCH = withErrorHandler(
  async (req: NextRequest, ctx: { params: Record<string, string> }) =>
    respond(await updateStockIssue(ctx.params.id!, await req.json())),
)

// DELETE /api/stock/issues/[id] - remove a register entry.
export const DELETE = withErrorHandler(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) =>
    respond(await deleteStockIssue(ctx.params.id!)),
)
