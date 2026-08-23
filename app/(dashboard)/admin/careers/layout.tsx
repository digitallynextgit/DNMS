import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Careers management",
  description: "Manage the public careers site, job groups and openings.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
