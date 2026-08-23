import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Payroll record",
  description: "A payroll record's full breakdown.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
