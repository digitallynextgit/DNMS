import type { Metadata } from "next"
import { StockClient } from "@/features/stock"

export const metadata: Metadata = { title: "Stock Register" }

// Routing glue only (CLAUDE.md rule #1): the feature owns the logic.
// Access: proxy.ts gates /stock on employee:read; the APIs enforce the same.
export default function StockPage() {
  return <StockClient />
}
