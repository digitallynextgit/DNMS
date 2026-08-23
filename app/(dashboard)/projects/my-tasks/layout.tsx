import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "My tasks",
  description: "Every task assigned to you across projects.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
