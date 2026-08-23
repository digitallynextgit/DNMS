import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Holidays",
  description: "Manage the company holiday calendar.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
