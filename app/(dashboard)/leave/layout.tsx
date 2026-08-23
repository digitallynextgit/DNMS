import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Leave",
  description: "Apply for leave and track your balances.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
