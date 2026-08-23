import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Project progress",
  description: "Completion and on-time delivery metrics per team.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
