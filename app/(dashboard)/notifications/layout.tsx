import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Notifications",
  description: "Your alerts and updates from across DNMS.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
