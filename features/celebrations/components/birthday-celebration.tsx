import { birthdayShowsFor } from "../server/celebrations.service"
import type { BirthdayViewer } from "../types"
import { BirthdayShow } from "./birthday-show"

/** Mounted by the dashboard layout, so it plays on each full page load, not on in-app navigation. */
export async function BirthdayCelebration({ viewer }: { viewer: BirthdayViewer }) {
  const shows = await birthdayShowsFor(viewer)
  return shows.length > 0 ? <BirthdayShow shows={shows} /> : null
}
