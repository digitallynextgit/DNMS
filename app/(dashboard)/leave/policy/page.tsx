import { redirect } from "next/navigation"

// Leave Policy has been merged into Leave Types & Policy. Keep this route as a
// redirect so old links / bookmarks still land on the right tab.
export default function LeavePolicyRedirect() {
  redirect("/leave/types?tab=policy")
}
