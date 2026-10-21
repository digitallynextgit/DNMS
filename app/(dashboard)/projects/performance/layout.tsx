import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Team performance",
  description: "Delivery scores per person and team: goals, deliverables and tasks on time.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
