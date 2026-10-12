import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"
import { NotFoundError } from "@/lib/errors"
import { BIRTHDAY } from "../constants"
import type { BirthdayShowProps } from "../types"

interface Viewer {
  id: string
  email?: string | null
}

function isCelebrant(viewer: Viewer): boolean {
  return viewer.id === BIRTHDAY.employeeId || viewer.email?.toLowerCase() === BIRTHDAY.email
}

function isPreviewer(viewer: Viewer): boolean {
  return (BIRTHDAY.previewEmails as readonly string[]).includes(viewer.email?.toLowerCase() ?? "")
}

/** Plays on every full page load: for her on her birthday, for the preview accounts any day. */
export function birthdayShowFor(viewer: Viewer, now = Date.now()): BirthdayShowProps | null {
  const herDay = isCelebrant(viewer) && now >= BIRTHDAY.startsAt && now < BIRTHDAY.endsAt
  if (!herDay && !isPreviewer(viewer)) return null
  return {
    name: BIRTHDAY.name,
    photos: BIRTHDAY.chapters.map((c, i) => ({
      src: `/api/celebrations/photos/${i + 1}`,
      caption: c.caption,
      line: c.line,
    })),
  }
}

/** Her photos go only to her and the preview accounts; anyone else gets a 404. */
export async function readBirthdayPhoto(viewer: Viewer, n: number): Promise<Buffer> {
  if (!isCelebrant(viewer) && !isPreviewer(viewer)) throw new NotFoundError("Photo")
  if (!Number.isInteger(n) || n < 1 || n > BIRTHDAY.chapters.length) {
    throw new NotFoundError("Photo")
  }
  return readFile(path.join(process.cwd(), "features", "celebrations", "photos", `${n}.webp`))
}
