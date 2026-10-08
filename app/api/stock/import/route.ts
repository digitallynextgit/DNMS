import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { importStock } from "@/features/stock/server/stock.service"

// The dialog parses the workbook in the browser and sends plain JSON.
export const POST = withErrorHandler(async (req: NextRequest) =>
  respond(await importStock(await req.json()), 201),
)
