import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Leave directory",
  description: "Company-wide leave requests and balances.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
