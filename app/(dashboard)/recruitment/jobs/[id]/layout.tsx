import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Job posting",
  description: "A job posting and its applicants.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
