import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "WFH requests",
  description: "Review and act on work-from-home requests.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
