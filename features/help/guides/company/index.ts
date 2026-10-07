import type { HelpGuide } from "../../types"
import { chatGuide } from "./chat"
import { announcementsGuide } from "./announcements"
import { photoGalleryGuide } from "./photo-gallery"
import { documentsGuide } from "./documents"
import { orgChartGuide } from "./org-chart"

/** Company-wide pages: Chat, Announcements, Photo Gallery, Documents, Organisation Chart. In the order they are listed. */
export const companyGuides: HelpGuide[] = [
  chatGuide,
  announcementsGuide,
  photoGalleryGuide,
  documentsGuide,
  orgChartGuide,
]
