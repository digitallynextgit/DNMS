import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Docs",
  description: "Product documentation and how-to guides for DNMS.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
