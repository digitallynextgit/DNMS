import type { Metadata } from "next"
import { GstCalculator } from "@/features/tools"

export const metadata: Metadata = {
  title: "GST Calculator",
  description: "Add or remove GST, with the CGST / SGST or IGST split.",
}

export default function Page() {
  return <GstCalculator />
}
