import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Audit log",
  description: "Review who did what across the system, with actor, IP and entity detail.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
