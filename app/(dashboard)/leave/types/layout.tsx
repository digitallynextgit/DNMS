import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Leave types",
  description: "Configure leave types and the policy matrix.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
