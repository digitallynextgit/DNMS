import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Onboarding checklist",
  description: "One joiner's onboarding progress.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
