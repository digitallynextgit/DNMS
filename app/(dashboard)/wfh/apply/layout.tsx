import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Apply for WFH",
  description: "Submit a work-from-home request.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
