import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "KPI profiles",
  description: "Define reusable weighted KPI scorecards.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
