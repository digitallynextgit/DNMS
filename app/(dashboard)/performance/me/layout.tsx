import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "My performance",
  description: "Your reviews, scores and self-assessments.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
