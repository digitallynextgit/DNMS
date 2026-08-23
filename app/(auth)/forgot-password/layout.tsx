import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset your DNMS account password.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
