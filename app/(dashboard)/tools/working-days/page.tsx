import type { Metadata } from "next"
import { WorkingDaysCalculator } from "@/features/tools"

export const metadata: Metadata = {
  title: "Working Days Calculator",
  description: "Count working days between two dates, skipping weekends and holidays.",
}

export default function Page() {
  return <WorkingDaysCalculator />
}
