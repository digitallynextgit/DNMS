// Repository tab row model: stored files, Drive files, links and folders flattened into one shape.
import type { DocTag } from "./doc-tag"

export type Source = "b2" | "drive" | "link" | "folder"
export type FileType = "doc" | "sheet" | "pdf" | "image" | "folder" | "link" | "other"
export type SortKey = "name" | "type" | "size" | "modified" | "addedBy"

export interface Person {
  name: string
  photo: string | null
  initials: string
}

export interface UnifiedFile {
  id: string
  source: Source
  name: string
  size: number | null
  mimeType: string
  modified: string | null
  webViewLink?: string | null
  /** Links only. */
  url?: string
  type: FileType
  /** Folders have no tag; links may have none. */
  tag: DocTag | null
  /** Whether `tag` is a stored value that can be corrected, or a live guess. */
  tagIsStored: boolean
  addedBy: Person | null
  /** Uploader / creator - who may edit it besides managers. Null for Drive rows. */
  ownerId: string | null
  description?: string | null
  /** Folders only. */
  itemCount?: number
  driveFolderId?: string | null
  /** Drive only: short-lived preview image, used by the card grid. */
  thumbnailLink?: string | null
  /** Uploads (source "b2") only: where the bytes live. Uploads go to Drive once the Repository moves there. */
  storedIn?: "b2" | "drive"
  /** Search results only: the folder path it lives in ("" = the top level) and that folder's id. */
  location?: string
  locationFolderId?: string | null
}

/** Where an item's bytes live, for the Storage badge and filter. */
export function storageOf(f: UnifiedFile): Source {
  return f.source === "b2" ? (f.storedIn ?? "b2") : f.source
}

export const TYPE_LABEL: Record<FileType, string> = {
  doc: "Google Doc",
  sheet: "Google Sheet",
  pdf: "PDF",
  image: "Image",
  folder: "Folder",
  link: "Link",
  other: "File",
}

export function fmtBytes(b: number | null): string {
  if (!b) return "-"
  if (b < 1024) return `${b} B`
  const u = ["KB", "MB", "GB"]
  let n = b / 1024
  let i = 0
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(1)} ${u[i]}`
}

export function classify(mime: string, source: Source): FileType {
  if (mime.includes("spreadsheet")) return "sheet"
  if (mime.includes("document") && source === "drive") return "doc"
  if (mime.includes("pdf")) return "pdf"
  if (mime.startsWith("image/")) return "image"
  return "other"
}

interface PersonLike {
  firstName: string | null
  lastName: string | null
  profilePhoto?: string | null
}

export function person(p: PersonLike): Person {
  const first = p.firstName ?? ""
  const last = p.lastName ?? ""
  return {
    name: `${first} ${last}`.trim(),
    photo: p.profilePhoto ?? null,
    initials: `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?",
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function byName(a: UnifiedFile, b: UnifiedFile): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
}

export function compare(a: UnifiedFile, b: UnifiedFile, key: SortKey): number {
  switch (key) {
    case "name":
      return byName(a, b)
    case "type":
      return TYPE_LABEL[a.type].localeCompare(TYPE_LABEL[b.type])
    case "size":
      return (a.size ?? -1) - (b.size ?? -1)
    case "modified":
      return (a.modified ?? "").localeCompare(b.modified ?? "")
    case "addedBy":
      return (a.addedBy?.name ?? "").localeCompare(b.addedBy?.name ?? "")
  }
}

// Office files in Drive open in Google's editors, which save back to the same file, so the whole
// team sees one copy. "rtpof" is Google's Office-editing mode.
const GOOGLE_EDITORS: [RegExp, RegExp, string][] = [
  [/spreadsheetml|ms-excel/, /\.(xlsx|xlsm|xls)$/i, "spreadsheets"],
  [/wordprocessingml|msword/, /\.(docx|doc)$/i, "document"],
  [/presentationml|ms-powerpoint/, /\.(pptx|ppt)$/i, "presentation"],
]

/**
 * Open the file as the person's WORK account. Without this Google uses whichever account the
 * browser defaults to - usually a personal Gmail - and shows "You need access" for a file that is
 * in fact shared with them.
 */
export function withAuthUser(url: string, email?: string | null): string {
  if (!url || !email || !email.includes("@")) return url
  if (/[?&]authuser=/.test(url)) return url
  return `${url}${url.includes("?") ? "&" : "?"}authuser=${encodeURIComponent(email)}`
}

/** Where a Drive file opens: Sheets/Docs/Slides for Office files, else Drive's own viewer. */
export function driveOpenUrl(
  f: {
    driveFileId: string
    mimeType: string
    fileName: string
    webViewLink: string | null
  },
  authuser?: string | null,
): string {
  for (const [mime, ext, app] of GOOGLE_EDITORS) {
    if (mime.test(f.mimeType) || ext.test(f.fileName)) {
      return withAuthUser(
        `https://docs.google.com/${app}/d/${f.driveFileId}/edit?rtpof=true&sd=true`,
        authuser,
      )
    }
  }
  return withAuthUser(
    f.webViewLink ?? `https://drive.google.com/file/d/${f.driveFileId}/view`,
    authuser,
  )
}

/** The one-line summary under a name, in both the table and the cards. */
export function subtitleOf(f: UnifiedFile): string {
  const where = f.location === undefined ? "" : ` · in ${f.location || "Repository"}`
  if (f.source === "folder")
    return `${f.itemCount ?? 0} ${f.itemCount === 1 ? "item" : "items"}${where}`
  if (f.source === "link") return `${hostOf(f.url ?? "")}${where}`
  return `${TYPE_LABEL[f.type]}${f.size ? ` · ${fmtBytes(f.size)}` : ""}${where}`
}
