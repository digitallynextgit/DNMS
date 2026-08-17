import { AnnouncementsBoard } from "@/features/noticeboard"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Announcements" }

// Routing glue only: the board renders its own PageHeader so the "New
// announcement" action sits in the header like every other DNMS list page.
export default function AnnouncementsPage() {
  return <AnnouncementsBoard />
}
