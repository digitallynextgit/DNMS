import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Payslip",
  description: "View a single payslip in detail.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
