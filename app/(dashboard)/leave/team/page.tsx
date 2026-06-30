import { redirect } from "next/navigation"

// The team approval queue is now part of the Leave Directory (Requests tab).
// Keep this route as a redirect so old links / bookmarks / notifications resolve.
export default function TeamLeaveRedirect() {
  redirect("/leave/leave-directory")
}
