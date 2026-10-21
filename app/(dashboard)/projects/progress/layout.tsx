import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Progress & performance",
  description: "Deliverables done, to do and overdue, and delivery scores per person and team.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
