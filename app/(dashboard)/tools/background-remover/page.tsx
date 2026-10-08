import type { Metadata } from "next"
import { BackgroundRemover } from "@/features/tools"

export const metadata: Metadata = {
  title: "Background Remover",
  description: "Remove the background from a photo, with AI on your own computer.",
}

export default function Page() {
  return <BackgroundRemover />
}
