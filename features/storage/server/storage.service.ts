import "server-only"

import { db } from "@/server/db"
import {
  isB2Configured,
  listAllObjects,
  getSignedUrl,
  deleteFile,
  type StorageObject,
} from "@/lib/storage"
import { getConfig } from "@/server/app-config"
import type { StorageCategory, StorageFile, StorageOverview } from "../types"
import { CATEGORY_LABELS } from "../types"

const FREE_TIER_BYTES = 10 * 1024 * 1024 * 1024 // Backblaze B2 free tier = 10 GB

const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i

/** Original filename: last path segment with the `<uuid>-` prefix stripped. */
function displayName(key: string): string {
  const base = key.split("/").pop() ?? key
  return base.replace(UUID_PREFIX, "")
}

function categorize(key: string): StorageCategory {
  if (key.startsWith("profile-photos/")) return "profile-photos"
  if (key.startsWith("employee-documents/")) return "employee-documents"
  if (key.startsWith("documents/")) return "company-documents"
  if (key.startsWith("projects/")) return "project-files"
  return "other"
}

/**
 * A complete picture of what is in the bucket: usage totals, a per-folder
 * breakdown, and every file resolved to a human owner and flagged referenced vs
 * orphaned (in the bucket but pointed at by no DB row = leaked storage).
 */
export async function getStorageOverview(): Promise<StorageOverview> {
  if (!(await isB2Configured())) {
    return {
      configured: false,
      bucket: null,
      totalBytes: 0,
      totalFiles: 0,
      freeTierBytes: FREE_TIER_BYTES,
      orphanBytes: 0,
      orphanCount: 0,
      categories: [],
      files: [],
    }
  }

  const bucket = (await getConfig("B2_EMPLOYEE_DOCS_BUCKET")) || "hrms-documents"

  // Bucket contents + every DB row that owns an object, in parallel.
  const [objects, photos, docs, empDocs, brandAssets, resources] = await Promise.all([
    listAllObjects(),
    db.employee.findMany({
      where: { profilePhotoKey: { not: null } },
      select: { profilePhotoKey: true, firstName: true, lastName: true },
    }),
    db.document.findMany({
      select: {
        objectKey: true,
        title: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    db.employeeDocument.findMany({
      select: {
        objectKey: true,
        title: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    db.brandAsset.findMany({
      select: { objectKey: true, fileName: true, project: { select: { name: true } } },
    }),
    db.projectResource.findMany({
      select: { objectKey: true, fileName: true, project: { select: { name: true } } },
    }),
  ])

  // key -> { owner, refType, name } for every referenced object.
  type Ref = { owner: string | null; refType: StorageFile["refType"]; name: string }
  const refs = new Map<string, Ref>()
  for (const p of photos)
    if (p.profilePhotoKey)
      refs.set(p.profilePhotoKey, {
        owner: `${p.firstName} ${p.lastName}`.trim(),
        refType: "photo",
        name: "Profile photo",
      })
  for (const d of docs)
    refs.set(d.objectKey, {
      owner: d.employee ? `${d.employee.firstName} ${d.employee.lastName}`.trim() : "Company",
      refType: "document",
      name: d.title,
    })
  for (const d of empDocs)
    refs.set(d.objectKey, {
      owner: d.employee ? `${d.employee.firstName} ${d.employee.lastName}`.trim() : null,
      refType: "employee-document",
      name: d.title,
    })
  for (const b of brandAssets)
    refs.set(b.objectKey, {
      owner: b.project?.name ?? "Project",
      refType: "brand-asset",
      name: b.fileName,
    })
  for (const r of resources)
    refs.set(r.objectKey, {
      owner: r.project?.name ?? "Project",
      refType: "project-resource",
      name: r.fileName,
    })

  const files: StorageFile[] = await Promise.all(
    objects.map(async (o: StorageObject) => {
      const ref = refs.get(o.key)
      const [url, downloadUrl] = await Promise.all([
        getSignedUrl(o.key, 3600).catch(() => ""),
        getSignedUrl(o.key, 3600, { downloadFileName: displayName(o.key) }).catch(() => ""),
      ])
      return {
        key: o.key,
        name: ref?.name || displayName(o.key),
        category: categorize(o.key),
        owner: ref?.owner ?? null,
        size: o.size,
        lastModified: o.lastModified,
        referenced: !!ref,
        refType: ref?.refType ?? null,
        url,
        downloadUrl,
      }
    }),
  )

  // Per-category totals.
  const catMap = new Map<StorageCategory, { count: number; size: number }>()
  for (const f of files) {
    const cur = catMap.get(f.category) ?? { count: 0, size: 0 }
    cur.count++
    cur.size += f.size
    catMap.set(f.category, cur)
  }

  const orphans = files.filter((f) => !f.referenced)

  return {
    configured: true,
    bucket,
    totalBytes: files.reduce((s, f) => s + f.size, 0),
    totalFiles: files.length,
    freeTierBytes: FREE_TIER_BYTES,
    orphanBytes: orphans.reduce((s, f) => s + f.size, 0),
    orphanCount: orphans.length,
    categories: [...catMap.entries()]
      .map(([category, v]) => ({ category, label: CATEGORY_LABELS[category], ...v }))
      .sort((a, b) => b.size - a.size),
    files: files.sort((a, b) => b.size - a.size),
  }
}

/**
 * Delete an object from B2 AND clear the DB row that points at it, so the app is
 * never left with a broken reference. Deleting an orphan just removes the object.
 * Returns the friendly name for the toast.
 */
export async function deleteStorageObject(key: string): Promise<{ name: string }> {
  // Remove the owning DB row / pointer first (best-effort per type), then the object.
  const [emp, doc, empDoc, brand, resource] = await Promise.all([
    db.employee.findFirst({ where: { profilePhotoKey: key }, select: { id: true } }),
    db.document.findFirst({ where: { objectKey: key }, select: { id: true, title: true } }),
    db.employeeDocument.findFirst({ where: { objectKey: key }, select: { id: true, title: true } }),
    db.brandAsset.findUnique({ where: { objectKey: key }, select: { id: true, fileName: true } }),
    db.projectResource.findUnique({
      where: { objectKey: key },
      select: { id: true, fileName: true },
    }),
  ])

  if (emp)
    await db.employee.update({
      where: { id: emp.id },
      data: { profilePhotoKey: null, profilePhoto: null },
    })
  if (doc) await db.document.delete({ where: { id: doc.id } })
  if (empDoc) await db.employeeDocument.delete({ where: { id: empDoc.id } })
  if (brand) await db.brandAsset.delete({ where: { id: brand.id } })
  if (resource) await db.projectResource.delete({ where: { id: resource.id } })

  await deleteFile(key).catch((e) => console.error("[storage] B2 delete failed:", key, e))

  const name =
    doc?.title ?? empDoc?.title ?? brand?.fileName ?? resource?.fileName ?? displayName(key)
  return { name }
}
