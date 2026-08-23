import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Add employee",
  description: "Onboard a new employee with codes, credentials and balances.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
