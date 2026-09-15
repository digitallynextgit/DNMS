import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Exit clearance",
  description: "One leaver's clearance and sign-offs.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
