import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "My work",
  description: "Your tasks, and the services and calendars you own, across projects.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
