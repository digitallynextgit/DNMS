// =============================================================================
// Company noticeboard
// =============================================================================
// Announcements, the photo gallery, and upcoming birthdays - the three things
// that make an internal tool feel like a company rather than a database.
//
// READS ARE OPEN to every signed-in employee by design. Writes need
// announcement:write / gallery:write. There is no read scope: a noticeboard
// nobody can see is not a noticeboard.
// =============================================================================

import "server-only"

import { db } from "@/server/db"
import { createAuditLog } from "@/lib/audit"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import {
  announcementSchema,
  albumSchema,
  type AnnouncementInput,
  type AlbumInput,
} from "../schemas/noticeboard.schema"
import { generateAlbumSlug, resolveAlbumId } from "./album-slug"
import type { Session } from "next-auth"

const AUTHOR = { select: { id: true, firstName: true, lastName: true, profilePhoto: true } }

const ANNOUNCEMENT_SELECT = {
  id: true,
  title: true,
  body: true,
  category: true,
  priority: true,
  isPublished: true,
  publishedAt: true,
  expiresAt: true,
  createdAt: true,
  createdBy: AUTHOR,
} as const

/**
 * What a reader is allowed to see: published, and not past its expiry.
 *
 * Expiry is enforced HERE rather than by a nightly job that flips a flag -
 * "stale notice still on the board" is the failure mode, and a query that can
 * never be out of date beats a job that can fail to run.
 */
function visibleWhere(canManage: boolean) {
  if (canManage) return {}
  return {
    isPublished: true,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  }
}

export async function listAnnouncements(
  canManage: boolean,
  opts: { category?: string; month?: number; year?: number; limit?: number } = {},
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const where: Record<string, unknown> = { ...visibleWhere(canManage) }
    if (opts.category) where.category = opts.category
    if (opts.month && opts.year) {
      // Month is 1-12 from the UI; Date's month is 0-indexed.
      const from = new Date(opts.year, opts.month - 1, 1)
      const to = new Date(opts.year, opts.month, 1)
      where.publishedAt = { gte: from, lt: to }
    }

    const [items, all] = await Promise.all([
      db.announcement.findMany({
        where,
        select: ANNOUNCEMENT_SELECT,
        // Priority first so an urgent notice cannot be pushed under the fold by
        // three routine ones posted after it.
        orderBy: [{ priority: "desc" }, { publishedAt: "desc" }],
        take: Math.min(opts.limit ?? 100, 200),
      }),
      db.announcement.findMany({
        where: visibleWhere(canManage),
        select: { category: true, priority: true, publishedAt: true },
      }),
    ])

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000)
    return ok(
      serialize({
        data: {
          items,
          categories: [...new Set(all.map((a) => a.category))].sort(),
          stats: {
            total: all.length,
            newThisWeek: all.filter((a) => a.publishedAt >= weekAgo).length,
            highPriority: all.filter((a) => a.priority === "HIGH").length,
            categoriesActive: new Set(all.map((a) => a.category)).size,
          },
        },
      }),
    )
  })
}

export async function createAnnouncement(
  body: AnnouncementInput,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = announcementSchema.parse(body)
    const row = await db.announcement.create({
      data: {
        title: input.title,
        body: input.body,
        category: input.category,
        priority: input.priority,
        isPublished: input.isPublished,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        createdById: session.user.id,
      },
      select: ANNOUNCEMENT_SELECT,
    })
    await createAuditLog(session, {
      action: "announcement:create",
      module: "company",
      entityType: "Announcement",
      entityId: row.id,
      changes: { title: input.title, category: input.category, priority: input.priority },
    })
    return ok(serialize({ data: row }))
  })
}

export async function updateAnnouncement(
  id: string,
  body: AnnouncementInput,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = announcementSchema.parse(body)
    const existing = await db.announcement.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return fail("Announcement not found", undefined, 404)

    const row = await db.announcement.update({
      where: { id },
      data: {
        title: input.title,
        body: input.body,
        category: input.category,
        priority: input.priority,
        isPublished: input.isPublished,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
      select: ANNOUNCEMENT_SELECT,
    })
    await createAuditLog(session, {
      action: "announcement:update",
      module: "company",
      entityType: "Announcement",
      entityId: id,
      changes: { title: input.title, category: input.category, priority: input.priority },
    })
    return ok(serialize({ data: row }))
  })
}

export async function deleteAnnouncement(
  id: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const existing = await db.announcement.findUnique({ where: { id }, select: { title: true } })
    if (!existing) return fail("Announcement not found", undefined, 404)
    await db.announcement.delete({ where: { id } })
    await createAuditLog(session, {
      action: "announcement:delete",
      module: "company",
      entityType: "Announcement",
      entityId: id,
      changes: { title: existing.title },
    })
    return ok(serialize({ data: { id } }))
  })
}

// ─── Gallery ────────────────────────────────────────────────────────────────

export async function listAlbums(search?: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const albums = await db.photoAlbum.findMany({
      where: search ? { title: { contains: search, mode: "insensitive" } } : {},
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        eventDate: true,
        createdAt: true,
        createdBy: AUTHOR,
        _count: { select: { photos: true } },
        // One photo for the cover tile. Cheaper than loading the album to
        // discover it has 200 images.
        photos: { select: { id: true }, orderBy: { createdAt: "asc" }, take: 1 },
      },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      take: 200,
    })

    const [totalPhotos, recentUploads] = await Promise.all([
      db.photo.count(),
      db.photo.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60_000) } },
      }),
    ])

    return ok(
      serialize({
        data: {
          albums: albums.map((a) => ({
            ...a,
            photoCount: a._count.photos,
            coverPhotoId: a.photos[0]?.id ?? null,
          })),
          stats: { totalAlbums: albums.length, totalPhotos, recentUploads },
        },
      }),
    )
  })
}

export async function getAlbum(ref: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const id = await resolveAlbumId(ref)
    if (!id) return fail("Album not found", undefined, 404)
    const album = await db.photoAlbum.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        eventDate: true,
        createdBy: AUTHOR,
        photos: {
          select: {
            id: true,
            caption: true,
            fileName: true,
            width: true,
            height: true,
            createdAt: true,
            uploadedBy: AUTHOR,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    })
    if (!album) return fail("Album not found", undefined, 404)
    return ok(serialize({ data: album }))
  })
}

export async function createAlbum(
  body: AlbumInput,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = albumSchema.parse(body)
    const id = crypto.randomUUID()
    const album = await db.photoAlbum.create({
      data: {
        id,
        slug: await generateAlbumSlug(input.title, id),
        title: input.title,
        description: input.description || null,
        eventDate: input.eventDate ? new Date(input.eventDate) : null,
        createdById: session.user.id,
      },
      select: { id: true, slug: true, title: true },
    })
    await createAuditLog(session, {
      action: "album:create",
      module: "company",
      entityType: "PhotoAlbum",
      entityId: album.id,
      changes: { title: input.title },
    })
    return ok(serialize({ data: album }))
  })
}

export async function deleteAlbum(ref: string, session: Session): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const id = await resolveAlbumId(ref)
    if (!id) return fail("Album not found", undefined, 404)
    const album = await db.photoAlbum.findUnique({
      where: { id },
      select: { title: true, photos: { select: { objectKey: true } } },
    })
    if (!album) return fail("Album not found", undefined, 404)

    // Reclaim the files first; the rows cascade with the album. A failure here
    // leaves orphaned objects (visible on the Storage screen) rather than rows
    // pointing at bytes that are already gone.
    const { deleteFile } = await import("@/lib/storage")
    for (const p of album.photos) {
      await deleteFile(p.objectKey).catch((e) =>
        console.error("[gallery] could not delete", p.objectKey, e),
      )
    }
    await db.photoAlbum.delete({ where: { id } })

    await createAuditLog(session, {
      action: "album:delete",
      module: "company",
      entityType: "PhotoAlbum",
      entityId: id,
      changes: { title: album.title, photos: album.photos.length },
    })
    return ok(serialize({ data: { id } }))
  })
}

export async function deletePhoto(id: string, session: Session): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const photo = await db.photo.findUnique({
      where: { id },
      select: { objectKey: true, fileName: true, albumId: true },
    })
    if (!photo) return fail("Photo not found", undefined, 404)

    const { deleteFile } = await import("@/lib/storage")
    await deleteFile(photo.objectKey).catch((e) =>
      console.error("[gallery] could not delete", photo.objectKey, e),
    )
    await db.photo.delete({ where: { id } })

    await createAuditLog(session, {
      action: "photo:delete",
      module: "company",
      entityType: "Photo",
      entityId: id,
      changes: { fileName: photo.fileName, albumId: photo.albumId },
    })
    return ok(serialize({ data: { id } }))
  })
}

// ─── Birthdays ──────────────────────────────────────────────────────────────

export interface BirthdayPerson {
  id: string
  firstName: string
  lastName: string
  profilePhoto: string | null
  designation: string | null
  /** "17 Aug" - the day itself, never the birth year. */
  dayLabel: string
  /** 0 = today, 1 = tomorrow, ... */
  inDays: number
}

/**
 * Today's and the next `days` days of birthdays.
 *
 * Computed on MONTH AND DAY only, and the birth year is never returned. Age is
 * not ours to broadcast to the whole company just because the date of birth
 * happens to be on file for payroll.
 *
 * 29 February folds onto 1 March in non-leap years rather than disappearing for
 * three years out of four.
 */
export async function listUpcomingBirthdays(days = 30): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const people = await db.employee.findMany({
      where: { isActive: true, dateOfBirth: { not: null } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profilePhoto: true,
        dateOfBirth: true,
        designation: { select: { title: true } },
      },
    })

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

    const upcoming: BirthdayPerson[] = []
    for (const p of people) {
      if (!p.dateOfBirth) continue
      // The column is a DATE; read its parts in UTC so a timezone offset cannot
      // shift somebody's birthday to the previous day.
      const bornMonth = p.dateOfBirth.getUTCMonth()
      const bornDay = p.dateOfBirth.getUTCDate()

      // This year first, then next: somebody whose birthday has already passed
      // this year is "in 300 days", not missing from the list.
      for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
        let month = bornMonth
        let day = bornDay
        if (bornMonth === 1 && bornDay === 29 && !isLeap(year)) {
          month = 2
          day = 1
        }
        const next = new Date(year, month, day)
        const inDays = Math.round((next.getTime() - today.getTime()) / 86_400_000)
        if (inDays < 0 || inDays > days) continue
        upcoming.push({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          profilePhoto: p.profilePhoto,
          designation: p.designation?.title ?? null,
          dayLabel: next.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          inDays,
        })
        break
      }
    }

    upcoming.sort((a, b) => a.inDays - b.inDays)
    return ok(serialize({ data: upcoming }))
  })
}

/** Send a birthday wish as an in-app notification, from one employee to another. */
export async function sendBirthdayWish(
  toEmployeeId: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    if (toEmployeeId === session.user.id) {
      return fail("You cannot send yourself birthday wishes", undefined, 400)
    }
    const target = await db.employee.findFirst({
      where: { id: toEmployeeId, isActive: true },
      select: { id: true, firstName: true },
    })
    if (!target) return fail("Employee not found", undefined, 404)

    const { createNotification } = await import("@/lib/notifications")
    await createNotification({
      employeeId: target.id,
      title: "Happy Birthday! 🎉",
      message: `${session.user.firstName} ${session.user.lastName} sent you birthday wishes`,
      type: "success",
      link: "/dashboard",
    })
    return ok(serialize({ data: { sent: true, to: target.firstName } }))
  })
}
