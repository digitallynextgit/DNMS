import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Tools",
  description: "Handy utilities for everyday work.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
