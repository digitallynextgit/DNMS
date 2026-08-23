import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Employee profile",
  description: "View an employee's profile, role and details.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
