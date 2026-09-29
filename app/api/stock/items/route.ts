import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getStockItems, createStockItem } from "@/features/stock/server/stock.service"

// GET /api/stock/items - the catalogue with computed issued/left quantities.
export const GET = withErrorHandler(async () => respond(await getStockItems()))

// POST /api/stock/items - add an item (name, price, purchased quantity).
export const POST = withErrorHandler(async (req: NextRequest) =>
  respond(await createStockItem(await req.json()), 201),
)
