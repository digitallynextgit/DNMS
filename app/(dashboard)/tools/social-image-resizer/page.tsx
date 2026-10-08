import type { Metadata } from "next"
import { SocialImageResizer } from "@/features/tools"

export const metadata: Metadata = {
  title: "Social Media Resizer",
  description: "Crop and resize an image to the exact size for each social network.",
}

export default function Page() {
  return <SocialImageResizer />
}
