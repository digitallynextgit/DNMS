// Public API for the "noticeboard" feature (CLAUDE.md §1, rule #2).
// Server modules are NOT re-exported: these components are client components, so
// anything reachable here lands in the browser bundle and `import "server-only"`
// would fail the build.

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
