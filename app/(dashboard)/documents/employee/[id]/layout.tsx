import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Employee documents",
  description: "Documents on file for a specific employee.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
