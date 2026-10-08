import type { Metadata } from "next"
import { PasswordGenerator } from "@/features/tools"

export const metadata: Metadata = {
  title: "Password Generator",
  description: "Create strong, random passwords.",
}

export default function Page() {
  return <PasswordGenerator />
}
