import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Job roles",
  description: "Manage department job roles.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
