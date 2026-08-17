import { GalleryView } from "@/features/noticeboard"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Photo Gallery" }

export default function GalleryPage() {
  return <GalleryView />
}
