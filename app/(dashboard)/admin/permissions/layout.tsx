import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Permissions",
  description: "See which roles hold which permission scopes across the platform.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
