import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Payroll directory",
  description: "Run and review company payroll.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
