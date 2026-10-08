import type { Metadata } from "next"
import { UtmBuilder } from "@/features/tools"

export const metadata: Metadata = {
  title: "UTM Link Builder",
  description: "Build campaign tracking links, with a QR code for each.",
}

export default function Page() {
  return <UtmBuilder />
}
