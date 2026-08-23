import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Analytics",
  description: "Executive dashboard across people, hiring, projects and attendance.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
