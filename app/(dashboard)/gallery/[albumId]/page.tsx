import { AlbumView } from "@/features/noticeboard"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Album",
  description: "Photos and videos in this album.",
}

// The segment is a slug; uuids still resolve so older shared links keep working.
export default async function AlbumPage({ params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params
  return <AlbumView albumRef={albumId} />
}
