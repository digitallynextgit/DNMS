import type { HelpGuide } from "../../types"
import { aiConnectionsGuide } from "./ai-connections"
import { dashboardGuide } from "./dashboard"
import { gettingStartedGuide } from "./getting-started"
import { myLeaveGuide } from "./my-leave"
import { myProfileGuide } from "./my-profile"
import { myReferralsGuide } from "./my-referrals"
import { notificationsGuide } from "./notifications"
import { waitingOnYouGuide } from "./waiting-on-you"

export const startSelfGuides: HelpGuide[] = [
  gettingStartedGuide,
  dashboardGuide,
  myProfileGuide,
  notificationsGuide,
  myLeaveGuide,
  waitingOnYouGuide,
  myReferralsGuide,
  aiConnectionsGuide,
]
