import type { Metadata } from "next"
import { StockClient } from "@/features/stock"

export const metadata: Metadata = { title: "Stock Register" }

// proxy.ts gates /stock on employee:read; the APIs enforce the same.
export default function StockPage() {
  return <StockClient />
}
