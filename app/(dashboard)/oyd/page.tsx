import type { Metadata } from "next"
import { OydPage } from "@/features/oyd"

export const metadata: Metadata = {
  title: "Own Your Deadline",
  description: "OYD flags for missed deadlines and delays.",
}

export default function Page() {
  return <OydPage />
}
