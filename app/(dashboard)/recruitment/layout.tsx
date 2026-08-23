import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Recruitment",
  description: "Job postings and the hiring pipeline.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
