import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Roles",
  description: "Create and manage roles and the permissions they grant.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
