import { ProfilePageSkeleton } from "@/components/shared/loading-skeleton"

// Mirrors ProfilePage: header + actions, avatar summary card, 5-tab bar, and the
// Info tab's two info cards. The client page's isLoading branch renders the same
// ProfilePageSkeleton, so there is no reflow between the two loading states.
export default function ProfileLoading() {
  return <ProfilePageSkeleton />
}
