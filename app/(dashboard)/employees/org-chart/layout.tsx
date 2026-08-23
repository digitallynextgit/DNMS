import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Org chart",
  description: "Visualize the company's reporting structure.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
