import "server-only"

import { ValidationError } from "@/lib/errors"
import { accountRootFolder, listAccountFolder } from "@/lib/google-drive"
import type { DriveBrowseListing } from "../types"

// Drive ids are URL-safe base64; anything else would land inside a Drive query string.
const DRIVE_ID = /^[A-Za-z0-9_-]{10,128}$/

export function assertDriveId(id: string): void {
  if (!DRIVE_ID.test(id)) throw new ValidationError("Not a Drive file id")
}

/** One folder of the company's DNMS tree in the connected account; null = the DNMS folder itself. */
export async function browseDrive(folderId: string | null): Promise<DriveBrowseListing> {
  if (folderId) assertDriveId(folderId)
  const root = folderId ? null : await accountRootFolder()
  const id = folderId ?? root?.id ?? null
  if (!id) return { folderId: null, items: [] }
  const items = await listAccountFolder(id)
  return {
    folderId: id,
    items: items.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      modifiedTime: f.modifiedTime,
      isFolder: f.isFolder,
      webViewLink: f.webViewLink,
    })),
  }
}
