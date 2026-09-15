import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "My clearances",
  description: "Checklist items and sign-offs waiting on you.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
