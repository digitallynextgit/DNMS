import type { Metadata } from "next"
import { FaviconMaker } from "@/features/tools"

export const metadata: Metadata = {
  title: "Favicon Maker",
  description: "Turn a logo into every website icon size.",
}

export default function Page() {
  return <FaviconMaker />
}
