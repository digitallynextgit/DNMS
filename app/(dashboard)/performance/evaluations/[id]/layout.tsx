import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Evaluation",
  description: "A performance evaluation in detail.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
