// Category = the top-level "folder" a B2 key belongs to, mapped to a friendly label.
export type StorageCategory =
  | "profile-photos"
  | "employee-documents"
  | "company-documents"
  | "project-files"
  | "other"

export interface StorageFile {
  /** The raw B2 object key (also the delete/reference id). */
  key: string
  /** Display name: the original filename, uuid prefix stripped. */
  name: string
  category: StorageCategory
  /** Human owner: an employee name, a project name, or "Company". */
  owner: string | null
  size: number
  lastModified: string | null
  /** True when a DB row still points at this object; false = orphaned/leaked. */
  referenced: boolean
  /** What kind of DB row owns it (drives the delete cleanup). */
  refType: "photo" | "document" | "employee-document" | "brand-asset" | "project-resource" | null
  /** Signed URL that opens inline (View). */
  url: string
  /** Signed URL that force-downloads under the real name. */
  downloadUrl: string
}

export interface StorageCategoryStat {
  category: StorageCategory
  label: string
  count: number
  size: number
}

export interface StorageOverview {
  configured: boolean
  bucket: string | null
  totalBytes: number
  totalFiles: number
  /** Free tier ceiling (Backblaze B2 = 10 GB), so the UI can show a gauge. */
  freeTierBytes: number
  orphanBytes: number
  orphanCount: number
  categories: StorageCategoryStat[]
  files: StorageFile[]
}

export const CATEGORY_LABELS: Record<StorageCategory, string> = {
  "profile-photos": "Profile Photos",
  "employee-documents": "Employee Documents",
  "company-documents": "Company Documents",
  "project-files": "Project Files",
  other: "Other",
}
