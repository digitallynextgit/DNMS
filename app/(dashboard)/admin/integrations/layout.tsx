import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect and configure third-party integrations and services.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
