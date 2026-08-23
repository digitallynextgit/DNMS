import { AlbumView } from "@/features/noticeboard"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Album",
  description: "Photos and videos in this album.",
}

// The segment is a SLUG now ("diwali-2026"). Uuids still resolve, so links
// shared before slugs existed keep working - see resolveAlbumId.
export default async function AlbumPage({ params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params
  return <AlbumView albumRef={albumId} />
}
