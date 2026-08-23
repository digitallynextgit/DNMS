import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Email templates",
  description: "Create and edit the transactional email templates DNMS sends.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
