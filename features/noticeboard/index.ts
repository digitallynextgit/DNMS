// Public API; server modules are not re-exported, since anything here reaches the browser bundle.

export {
  announcementSchema,
  albumSchema,
  SUGGESTED_CATEGORIES,
  PRIORITY_LABELS,
  type AnnouncementInput,
  type AnnouncementFormInput,
  type AlbumInput,
  type AlbumFormInput,
} from "./schemas/noticeboard.schema"

export {
  AnnouncementsCard,
  PhotoGalleryCard,
  BirthdaysCard,
  PRIORITY_TONE,
  type Announcement,
  type BirthdayPerson,
} from "./components/noticeboard-widgets"
export { AnnouncementsBoard } from "./components/announcements-board"
export { GalleryView, AlbumView } from "./components/gallery-view"
