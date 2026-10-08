import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

/** Old links (sent emails, bookmarks) land on the same view of /calendar. */
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
