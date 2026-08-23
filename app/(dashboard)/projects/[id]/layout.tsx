import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Project",
  description: "A project's teams, tasks, messages and delivery.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
