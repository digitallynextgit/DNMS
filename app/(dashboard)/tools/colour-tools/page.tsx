import type { Metadata } from "next"
import { ColourTools } from "@/features/tools"

export const metadata: Metadata = {
  title: "Colour Tools",
  description: "Pick colours from an image, convert colour codes and check contrast.",
}

export default function Page() {
  return <ColourTools />
}
