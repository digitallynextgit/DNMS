import "server-only"

import { NotFoundError, ValidationError } from "@/lib/errors"
import { accountRootFolder, isUnderFolder, listAccountFolder } from "@/lib/google-drive"
import type { DriveBrowseListing } from "../types"

// Drive ids are URL-safe base64; anything else would land inside a Drive query string.
const DRIVE_ID = /^[A-Za-z0-9_-]{10,128}$/

export function assertDriveId(id: string): void {
  if (!DRIVE_ID.test(id)) throw new ValidationError("Not a Drive file id")
}

/** The token can reach the whole connected account, so the admin browser stops at the DNMS folder. */
export async function assertInDnmsFolder(id: string): Promise<void> {
  const root = await accountRootFolder()
  if (!root || !(await isUnderFolder(id, root.id))) throw new NotFoundError("Drive item")
}

/** One folder of the company's DNMS tree in the connected account; null = the DNMS folder itself. */
export async function browseDrive(folderId: string | null): Promise<DriveBrowseListing> {
  if (folderId) assertDriveId(folderId)
  const root = await accountRootFolder()
  if (!root) return { folderId: null, items: [] }
  const id = folderId ?? root.id
  if (!(await isUnderFolder(id, root.id))) throw new NotFoundError("Drive folder")
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
