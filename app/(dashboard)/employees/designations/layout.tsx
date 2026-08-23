import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Designations",
  description: "Manage employee designations and levels.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
