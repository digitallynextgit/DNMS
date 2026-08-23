import { GalleryView } from "@/features/noticeboard"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Photo Gallery",
  description: "Company photo and video albums.",
}

export default function GalleryPage() {
  return <GalleryView />
}
