import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Attendance devices",
  description: "Manage biometric attendance terminals and their sync.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
