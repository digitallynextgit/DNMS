import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "My payslips",
  description: "View and download your payslips.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
