import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Calendar",
  description: "Manage company holidays, and see the other company calendars.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
