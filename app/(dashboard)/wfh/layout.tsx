import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Work from home",
  description: "Request and track your work-from-home days.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
