import "server-only"

import { db } from "@/server/db"
import { isB2Configured, listAllObjects, deleteFile, type StorageObject } from "@/lib/storage"
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
  if (key.startsWith("project-logos/")) return "project-logos"
  if (key.startsWith("projects/")) return "project-files"
  if (key.startsWith("gallery/")) return "gallery"
  if (key.startsWith("mailer-images/")) return "mailer-images"
  if (key.startsWith("chat/")) return "chat"
  if (key.startsWith("resumes/")) return "resumes"
  return "other"
}

/** The bucket NAME to show in the header - the account's, or the legacy setting. */
async function bucketNameFor(accountId?: string): Promise<string> {
  try {
    const account = accountId
      ? await db.storageAccount.findUnique({ where: { id: accountId }, select: { bucket: true } })
      : await db.storageAccount.findFirst({
          where: { isDefault: true, isActive: true },
          select: { bucket: true },
        })
    if (account?.bucket) return account.bucket
  } catch {
    /* fall through to the legacy setting */
  }
  return (await getConfig("B2_EMPLOYEE_DOCS_BUCKET")) || "hrms-documents"
}

export async function getStorageOverview(accountId?: string): Promise<StorageOverview> {
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

  const bucket = await bucketNameFor(accountId)

  // Rows that own an object. Keep these UNBOUNDED: a missed row marks a live file as an orphan
  // and "Clean up orphans" deletes it. Run 3 at a time to spare the 10-connection pool.
  const objectsPromise = listAllObjects(accountId)

  const [photos, docs, empDocs] = await Promise.all([
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
  ])

  const [brandAssets, resources, projectLogos] = await Promise.all([
    db.brandAsset.findMany({
      select: { objectKey: true, fileName: true, project: { select: { name: true } } },
    }),
    db.projectResource.findMany({
      select: { objectKey: true, fileName: true, project: { select: { name: true } } },
    }),
    db.project.findMany({
      where: { logoKey: { not: null } },
      select: { logoKey: true, name: true },
    }),
  ])

  const [galleryPhotos, mailerImages, chatAttachments] = await Promise.all([
    db.photo.findMany({
      select: {
        objectKey: true,
        // The thumbnail is a second live object on the same row.
        thumbKey: true,
        fileName: true,
        album: { select: { title: true } },
      },
    }),
    db.projectMailerAsset.findMany({
      select: { objectKey: true, fileName: true, project: { select: { name: true } } },
    }),
    db.chatAttachment.findMany({
      select: {
        objectKey: true,
        fileName: true,
        message: { select: { sender: { select: { firstName: true, lastName: true } } } },
      },
    }),
  ])

  const [messageAttachments, applicants, objects] = await Promise.all([
    db.projectMessageAttachment.findMany({
      select: {
        objectKey: true,
        fileName: true,
        reply: { select: { message: { select: { project: { select: { name: true } } } } } },
      },
    }),
    db.applicant.findMany({
      where: { OR: [{ resumeKey: { not: null } }, { resumeUrl: { not: null } }] },
      select: { resumeKey: true, resumeUrl: true, firstName: true, lastName: true },
    }),
    objectsPromise,
  ])

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
  for (const r of resources) {
    // Drive-hosted rows (video) have no object in this bucket.
    if (!r.objectKey) continue
    refs.set(r.objectKey, {
      owner: r.project?.name ?? "Project",
      refType: "project-resource",
      name: r.fileName,
    })
  }
  for (const p of projectLogos)
    if (p.logoKey)
      refs.set(p.logoKey, {
        owner: p.name,
        refType: "project-logo",
        name: "Project logo",
      })
  for (const g of galleryPhotos) {
    refs.set(g.objectKey, {
      owner: g.album?.title ?? "Photo Gallery",
      refType: "gallery-photo",
      name: g.fileName,
    })
    if (g.thumbKey)
      refs.set(g.thumbKey, {
        owner: g.album?.title ?? "Photo Gallery",
        refType: "gallery-thumb",
        name: g.fileName + " (thumbnail)",
      })
  }
  for (const m of mailerImages)
    refs.set(m.objectKey, {
      owner: m.project?.name ?? "Campaign",
      refType: "mailer-image",
      name: m.fileName,
    })
  for (const c of chatAttachments) {
    const s = c.message?.sender
    refs.set(c.objectKey, {
      owner: s ? `${s.firstName} ${s.lastName}`.trim() : "Chat",
      refType: "chat-attachment",
      name: c.fileName,
    })
  }
  for (const a of messageAttachments)
    refs.set(a.objectKey, {
      owner: a.reply?.message?.project?.name ?? "Project",
      refType: "project-message-attachment",
      name: a.fileName,
    })

  // Rows uploaded before resumeKey existed only have resumeUrl, so fall back to a substring match.
  const resumeKeys = objects
    .map((o: StorageObject) => o.key)
    .filter((k: string) => k.startsWith("resumes/"))
  for (const a of applicants) {
    const key =
      a.resumeKey ?? (a.resumeUrl ? resumeKeys.find((k: string) => a.resumeUrl!.includes(k)) : null)
    if (key)
      refs.set(key, {
        owner: `${a.firstName} ${a.lastName}`.trim(),
        refType: "applicant-resume",
        name: "Resume",
      })
  }

  // No presigning here: URLs are minted on demand by GET /api/admin/storage/object.
  const files: StorageFile[] = objects.map((o: StorageObject) => {
    const ref = refs.get(o.key)
    return {
      key: o.key,
      name: ref?.name || displayName(o.key),
      category: categorize(o.key),
      owner: ref?.owner ?? null,
      size: o.size,
      lastModified: o.lastModified,
      referenced: !!ref,
      refType: ref?.refType ?? null,
    }
  })

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

/** Deletes the object AND clears the DB row pointing at it. Returns a name for the toast. */
export async function deleteStorageObject(key: string): Promise<{ name: string }> {
  const [emp, doc, empDoc, brand, resource, project, chatFile, msgFile, applicant] =
    await Promise.all([
      db.employee.findFirst({ where: { profilePhotoKey: key }, select: { id: true } }),
      db.document.findFirst({ where: { objectKey: key }, select: { id: true, title: true } }),
      db.employeeDocument.findFirst({
        where: { objectKey: key },
        select: { id: true, title: true },
      }),
      db.brandAsset.findUnique({ where: { objectKey: key }, select: { id: true, fileName: true } }),
      db.projectResource.findUnique({
        where: { objectKey: key },
        select: { id: true, fileName: true },
      }),
      db.project.findFirst({ where: { logoKey: key }, select: { id: true, name: true } }),
      db.chatAttachment.findFirst({
        where: { objectKey: key },
        select: { id: true, fileName: true },
      }),
      db.projectMessageAttachment.findFirst({
        where: { objectKey: key },
        select: { id: true, fileName: true },
      }),
      // Older rows only have resumeUrl (a signed URL), so also match the key inside it.
      db.applicant.findFirst({
        where: { OR: [{ resumeKey: key }, { resumeUrl: { contains: key } }] },
        select: { id: true, firstName: true, lastName: true },
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
  if (project)
    await db.project.update({ where: { id: project.id }, data: { logo: null, logoKey: null } })
  if (chatFile) await db.chatAttachment.delete({ where: { id: chatFile.id } })
  if (msgFile) await db.projectMessageAttachment.delete({ where: { id: msgFile.id } })
  if (applicant)
    await db.applicant.update({
      where: { id: applicant.id },
      data: { resumeUrl: null, resumeKey: null },
    })

  await deleteFile(key).catch((e) => console.error("[storage] B2 delete failed:", key, e))

  const name =
    doc?.title ??
    empDoc?.title ??
    brand?.fileName ??
    resource?.fileName ??
    chatFile?.fileName ??
    msgFile?.fileName ??
    (project ? `${project.name} logo` : null) ??
    (applicant ? `${applicant.firstName} ${applicant.lastName}`.trim() + " resume" : null) ??
    displayName(key)
  return { name }
}
