import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Applications",
  description: "Candidate applications and their pipeline stages.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
