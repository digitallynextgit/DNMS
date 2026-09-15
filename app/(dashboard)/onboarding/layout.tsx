import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Onboarding",
  description: "Track every new joiner's onboarding checklist.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
