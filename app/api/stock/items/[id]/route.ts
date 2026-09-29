import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { updateStockItem } from "@/features/stock/server/stock.service"

// PATCH /api/stock/items/[id] - rename, reprice, or correct the purchased qty.
export const PATCH = withErrorHandler(
  async (req: NextRequest, ctx: { params: Record<string, string> }) =>
    respond(await updateStockItem(ctx.params.id!, await req.json())),
)
