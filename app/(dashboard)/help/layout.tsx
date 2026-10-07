import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Help & Guides",
  description: "Step-by-step guides for every part of DNMS, in English and Hindi.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
