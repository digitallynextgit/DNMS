import type { Metadata } from "next"
import { ImageConverter } from "@/features/tools"

export const metadata: Metadata = {
  title: "Image Converter",
  description: "Change images between JPG, PNG and WebP, and turn iPhone HEIC photos into JPG.",
}

export default function Page() {
  return <ImageConverter />
}
