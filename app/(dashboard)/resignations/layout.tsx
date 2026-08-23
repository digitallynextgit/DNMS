import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Resignations",
  description: "Manage employee resignations and their status.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
