import type { Metadata } from "next"
import { SearchPreview } from "@/features/tools"

export const metadata: Metadata = {
  title: "Google & Social Preview",
  description: "Preview how a page looks in Google and when shared on social.",
}

export default function Page() {
  return <SearchPreview />
}
