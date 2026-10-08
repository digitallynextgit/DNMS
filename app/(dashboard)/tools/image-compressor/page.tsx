import type { Metadata } from "next"
import { ImageCompressor } from "@/features/tools"

export const metadata: Metadata = {
  title: "Image Compressor",
  description: "Make JPG, PNG and WebP images smaller, many at once.",
}

export default function Page() {
  return <ImageCompressor />
}
