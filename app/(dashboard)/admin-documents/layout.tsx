import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Admin Documents",
  description: "Documents for admins and HR only.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
