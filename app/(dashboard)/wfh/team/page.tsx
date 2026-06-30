import { redirect } from "next/navigation"

// WFH approvals are now part of the single Work From Home page (the "WFH Requests"
// tab, shown to managers/HR). Keep this route as a redirect for old links.
export default function TeamWfhRedirect() {
  redirect("/wfh")
}
