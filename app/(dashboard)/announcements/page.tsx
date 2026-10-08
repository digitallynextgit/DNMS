import { AnnouncementsBoard } from "@/features/noticeboard"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Announcements",
  description: "Post and manage company-wide announcements.",
}

export default function AnnouncementsPage() {
  return <AnnouncementsBoard />
}
