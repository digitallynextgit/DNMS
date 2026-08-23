import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Apply for leave",
  description: "Submit a new leave request for approval.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
