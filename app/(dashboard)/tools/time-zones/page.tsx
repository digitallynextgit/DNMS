import type { Metadata } from "next"
import { TimeZoneConverter } from "@/features/tools"

export const metadata: Metadata = {
  title: "Time Zone Converter",
  description: "See the time for clients abroad and find a good time for a call.",
}

export default function Page() {
  return <TimeZoneConverter />
}
