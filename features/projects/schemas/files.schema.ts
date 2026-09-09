import { z } from "zod"

import { isDocTag } from "../lib/doc-tag"
import { isSafeHttpUrl } from "../lib/task-links"

const name = z.string().trim().min(1, "Name is required").max(120, "Keep it under 120 characters")
const folderId = z.string().trim().min(1).nullable()
const tag = z
  .string()
  .nullable()
  .refine((v) => v === null || isDocTag(v), "Invalid tag")

export const folderCreateSchema = z.object({
  name,
  parentId: folderId.optional().default(null),
})

export const folderUpdateSchema = z
  .object({
    name: name.optional(),
    parentId: folderId.optional(),
  })
  .refine((v) => v.name !== undefined || v.parentId !== undefined, "Nothing to update")

const url = z
  .string()
  .trim()
  .min(1, "URL is required")
  .max(2048)
  .refine(isSafeHttpUrl, "Enter a full http(s) link")

export const linkCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  url,
  folderId: folderId.optional().default(null),
  tag: tag.optional().default(null),
  description: z.string().trim().max(1000).nullable().optional().default(null),
})

export const linkUpdateSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200).optional(),
    url: url.optional(),
    folderId: folderId.optional(),
    tag: tag.optional(),
    description: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update")

/** PATCH on a Backblaze file: retag, rename, or move. */
export const resourcePatchSchema = z
  .object({
    tag: tag.optional(),
    fileName: z.string().trim().min(1, "Name is required").max(255).optional(),
    folderId: folderId.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update")

/** PATCH on a Drive file: rename and/or move into an app folder (null = root). */
export const driveFilePatchSchema = z
  .object({
    fileId: z.string().trim().min(1),
    name: z.string().trim().min(1, "Name is required").max(255).optional(),
    folderId: folderId.optional(),
  })
  .refine((v) => v.name !== undefined || v.folderId !== undefined, "Nothing to update")

export type FolderCreateInput = z.infer<typeof folderCreateSchema>
export type FolderUpdateInput = z.infer<typeof folderUpdateSchema>
export type LinkCreateInput = z.infer<typeof linkCreateSchema>
export type LinkUpdateInput = z.infer<typeof linkUpdateSchema>
export type ResourcePatchInput = z.infer<typeof resourcePatchSchema>
export type DriveFilePatchInput = z.infer<typeof driveFilePatchSchema>
