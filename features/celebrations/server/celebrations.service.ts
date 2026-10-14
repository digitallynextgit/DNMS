import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"
import { db } from "@/server/db"
import { NotFoundError } from "@/lib/errors"
import { BIRTHDAY } from "../constants"
import type { BirthdayShowProps, BirthdayViewer } from "../types"

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** "M-D" of a moment, as a calendar day in India. */
function istMonthDay(now: number): string {
  const d = new Date(now + IST_OFFSET_MS)
  return `${d.getUTCMonth()}-${d.getUTCDate()}`
}

/** "M-D" of a date-only value (stored at UTC midnight). */
function dobMonthDay(dob: Date): string {
  return `${dob.getUTCMonth()}-${dob.getUTCDate()}`
}

function isCelebrant(viewer: BirthdayViewer): boolean {
  return viewer.id === BIRTHDAY.employeeId || viewer.email?.toLowerCase() === BIRTHDAY.email
}

/** Admins watch her show too, on her day only. */
function isAdmin(viewer: BirthdayViewer): boolean {
  return viewer.roles?.some((r) => r === "admin" || r === "admin_") ?? false
}

function isHerDay(now: number): boolean {
  return now >= BIRTHDAY.startsAt && now < BIRTHDAY.endsAt
}

function isPreviewer(viewer: BirthdayViewer): boolean {
  return (BIRTHDAY.previewEmails as readonly string[]).includes(viewer.email?.toLowerCase() ?? "")
}

function specialShow(): BirthdayShowProps {
  return {
    name: BIRTHDAY.name,
    photos: BIRTHDAY.chapters.map((c, i) => ({
      src: `/api/celebrations/photos/${i + 1}`,
      caption: c.caption,
      line: c.line,
    })),
    message:
      "Thank you for leading with heart, for every lesson you've taught us, and for always believing in us.",
    wish: "Wishing you a year as beautiful as you are.",
    signature: "With love, Team Digitally Next",
  }
}

function plainShow(firstName: string): BirthdayShowProps {
  return {
    // The big headline wants one word.
    name: firstName.trim().split(/\s+/)[0] || firstName,
    photos: [],
    message: "Wishing you a wonderful year ahead, full of joy, good health and success.",
    wish: "May every wish you make today come true.",
    signature: "From all of us at Digitally Next",
  }
}

/**
 * The shows to play for this person on this load, in order. Everyone gets a greeting on their
 * birthday; Manpreet gets her special show instead. The preview accounts see the special show any
 * day, and everyone else's greeting a day early, so it can be checked before they see it.
 */
export async function birthdayShowsFor(
  viewer: BirthdayViewer,
  now = Date.now(),
): Promise<BirthdayShowProps[]> {
  const shows: BirthdayShowProps[] = []
  const today = istMonthDay(now)
  const herDay = isCelebrant(viewer) && now >= BIRTHDAY.startsAt && now < BIRTHDAY.endsAt

  if (herDay || isPreviewer(viewer)) shows.push(specialShow())
  else if (isAdmin(viewer) && isHerDay(now)) {
    shows.push({ ...specialShow(), onceKey: `birthday:${BIRTHDAY.employeeId}:${today}` })
  }

  if (isPreviewer(viewer)) {
    const tomorrow = istMonthDay(now + DAY_MS)
    const people = await db.employee.findMany({
      where: { isActive: true, dateOfBirth: { not: null } },
      select: { id: true, firstName: true, dateOfBirth: true },
      orderBy: { firstName: "asc" },
    })
    for (const p of people) {
      if (p.id === BIRTHDAY.employeeId || !p.dateOfBirth) continue
      const day = dobMonthDay(p.dateOfBirth)
      if (day === today || day === tomorrow) shows.push(plainShow(p.firstName))
    }
  } else if (
    !isCelebrant(viewer) &&
    viewer.dateOfBirth &&
    dobMonthDay(viewer.dateOfBirth) === today
  ) {
    shows.push(plainShow(viewer.firstName ?? ""))
  }

  return shows
}

/** Her photos go only to her and the preview accounts; anyone else gets a 404. */
export async function readBirthdayPhoto(viewer: BirthdayViewer, n: number): Promise<Buffer> {
  const allowed =
    isCelebrant(viewer) || isPreviewer(viewer) || (isAdmin(viewer) && isHerDay(Date.now()))
  if (!allowed) throw new NotFoundError("Photo")
  if (!Number.isInteger(n) || n < 1 || n > BIRTHDAY.chapters.length) {
    throw new NotFoundError("Photo")
  }
  return readFile(path.join(process.cwd(), "features", "celebrations", "photos", `${n}.webp`))
}
