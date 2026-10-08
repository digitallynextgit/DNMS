import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getStockItems, createStockItem } from "@/features/stock/server/stock.service"

export const GET = withErrorHandler(async () => respond(await getStockItems()))

export const POST = withErrorHandler(async (req: NextRequest) =>
  respond(await createStockItem(await req.json()), 201),
)
