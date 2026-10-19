import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Weekly review",
  description: "A new joinee's Friday reviews after the 15-day scorecard.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
