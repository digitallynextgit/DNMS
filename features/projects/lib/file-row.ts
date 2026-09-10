/**
 * The Repository tab's row model and its pure helpers.
 *
 * Four sources (stored files, Drive files, links, folders) are flattened into
 * one `UnifiedFile` so the table and the card grid can render, sort and filter
 * the same shape. Nothing here touches React or the DOM - the presentational
 * pieces live in `components/files/file-bits.tsx`.
 */
import type { DocTag } from "./doc-tag"

export type Source = "b2" | "drive" | "link" | "folder"
export type FileType = "doc" | "sheet" | "pdf" | "image" | "folder" | "link" | "other"
export type SortKey = "name" | "type" | "size" | "modified" | "addedBy"

export interface Person {
  name: string
  photo: string | null
  initials: string
}

/** One row of the Repository, whichever of the four sources it came from. */
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
}

/** Human label per type. Kept apart from the icons so this file stays pure. */
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

/** Anything with a name and (optionally) a photo - our employee snippets all fit. */
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

/** The one-line summary under a name, in both the table and the cards. */
export function subtitleOf(f: UnifiedFile): string {
  if (f.source === "folder") return `${f.itemCount ?? 0} ${f.itemCount === 1 ? "item" : "items"}`
  if (f.source === "link") return hostOf(f.url ?? "")
  return `${TYPE_LABEL[f.type]}${f.size ? ` · ${fmtBytes(f.size)}` : ""}`
}
