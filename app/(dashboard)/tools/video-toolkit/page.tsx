import type { Metadata } from "next"
import { VideoToolkit } from "@/features/tools"

export const metadata: Metadata = {
  title: "Video Toolkit",
  description: "Compress, trim and convert videos, make GIFs and extract audio.",
}

export default function Page() {
  return <VideoToolkit />
}
