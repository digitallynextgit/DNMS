import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Employee attendance",
  description: "An employee's attendance calendar and monthly summary.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
