import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Documents",
  description: "Company and employee documents in one secure place.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
