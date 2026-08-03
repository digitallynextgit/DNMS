/**
 * Preset avatars, for employees who would rather not upload a photo.
 *
 * Grouped by job role so the picker reads as "pick a designer" rather than a
 * wall of 42 faces. The files live in public/avatars and are produced by
 * scripts/generate-avatars.ts - regenerate rather than hand-editing them.
 *
 * A chosen preset is stored in `Employee.profilePhoto` as its public path, so
 * every existing avatar consumer renders it as an ordinary image with no
 * special-casing. `profilePhotoKey` stays null, which is what distinguishes a
 * preset from an uploaded photo held in B2.
 *
 * SWAPPING IN GENERATED IMAGERY: nothing here assumes SVG beyond AVATAR_EXT.
 * Drop files at public/avatars/<id>.<ext> using the same ids, change AVATAR_EXT,
 * and the whole app follows. See docs/avatars.md.
 */

export const AVATAR_EXT = "webp"

/** How many variants exist per role. Keep in step with the generator. */
export const AVATARS_PER_ROLE = 6

export interface AvatarRole {
  key: string
  label: string
  /** Roughly which department this suits, shown as help text in the picker. */
  hint: string
}

export const AVATAR_ROLES: AvatarRole[] = [
  { key: "web", label: "Web & Development", hint: "Developers, engineers, QA" },
  { key: "design", label: "Design", hint: "UI/UX, creative, brand" },
  { key: "content", label: "Content", hint: "Writers, strategists, SEO" },
  { key: "video", label: "Video", hint: "Editors, videographers" },
  { key: "social", label: "Social & Marketing", hint: "SMO, ads, community" },
  { key: "hr", label: "HR & Admin", hint: "People ops, finance, admin" },
  { key: "lead", label: "Leadership", hint: "Managers, account managers" },
]

function idFor(roleKey: string, index: number): string {
  return `av-${roleKey}-${String(index + 1).padStart(2, "0")}`
}

/** Ids for one role, in display order. */
export function avatarIdsForRole(roleKey: string): string[] {
  return Array.from({ length: AVATARS_PER_ROLE }, (_, i) => idFor(roleKey, i))
}

/** Every id across every role. */
export const AVATAR_IDS: string[] = AVATAR_ROLES.flatMap((r) => avatarIdsForRole(r.key))

export const AVATAR_COUNT = AVATAR_IDS.length

export function avatarPath(id: string): string {
  return `/avatars/${id}.${AVATAR_EXT}`
}

const PATH_PATTERN = new RegExp(`^/avatars/(av-[a-z]+-\\d{2})\\.${AVATAR_EXT}$`)

/** True when a stored profilePhoto is one of the presets rather than an upload. */
export function isPresetAvatar(url: string | null | undefined): boolean {
  return !!url && PATH_PATTERN.test(url)
}

/** The preset id inside a stored path, or null if it is not a preset. */
export function avatarIdFromPath(url: string | null | undefined): string | null {
  const id = url?.match(PATH_PATTERN)?.[1]
  return id && AVATAR_IDS.includes(id) ? id : null
}

/** The role an id belongs to, or null for an unknown id. */
export function roleOfAvatar(id: string): AvatarRole | null {
  const key = id.split("-")[1]
  return AVATAR_ROLES.find((r) => r.key === key) ?? null
}

export function isValidAvatarId(id: unknown): id is string {
  return typeof id === "string" && AVATAR_IDS.includes(id)
}
