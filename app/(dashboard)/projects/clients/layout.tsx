import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Clients",
  description: "The companies projects are delivered for, their projects and portal contacts.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
