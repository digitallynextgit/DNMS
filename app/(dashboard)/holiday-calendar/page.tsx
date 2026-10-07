import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

/**
 * The Holiday Calendar is now one view of /calendar. Links that still point
 * here - notification emails already sent, bookmarks - land on the same view,
 * including the floating-requests tab (?tab=requests).
 */
export default async function HolidayCalendarRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const qs = new URLSearchParams({ view: "holidays" })
  if (typeof sp.tab === "string") qs.set("tab", sp.tab)
  redirect(`${await tenantPath("/calendar")}?${qs.toString()}`)
}
