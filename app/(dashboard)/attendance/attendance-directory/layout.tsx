import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Attendance directory",
  description: "Company-wide attendance records, status and corrections.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
