import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Edit employee",
  description: "Update an employee's profile and employment details.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
