import type { Session } from "next-auth"
import { birthdayShowFor } from "../server/celebrations.service"
import { BirthdayShow } from "./birthday-show"

/** Mounted by the dashboard layout, so it plays on each full page load, not on in-app navigation. */
export function BirthdayCelebration({ user }: { user: Session["user"] }) {
  const show = birthdayShowFor(user)
  return show ? <BirthdayShow {...show} /> : null
}
