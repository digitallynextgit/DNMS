import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Exit clearance",
  description: "Who is serving notice, and what is blocking their relieving.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
