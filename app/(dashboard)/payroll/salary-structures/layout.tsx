import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Salary structures",
  description: "Configure percentage-based salary component structures.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
